import type { DialectType } from "@conch/core";
import type { ProposeParamsResult } from "@conch/rpc";
import type { LanguageModel, ModelMessage } from "ai";

import {
  compileSqlTemplate,
  DATE_PRESETS,
  DbError,
  maskTemplateInputs,
  RANGE_PRESETS,
  tokenizeSqlTemplate,
} from "@conch/core/client";
import { ParamDef, RangePreset, toTemplateValue } from "@conch/rpc";
import { generateText, Output } from "ai";
import { z } from "zod";

import { classifyAIError } from "./ai-errors.ts";
import { assertReadOnly } from "./read-only-guard.ts";
import { NUMBER_LITERAL, restoreDefaults } from "./restore-defaults.ts";
import { DIALECT_LABELS } from "./schema-prompt.ts";

export const MAX_PROPOSED_PARAMS = 4;
export const PROPOSE_TIMEOUT_MS = 20_000;
const MAX_PROPOSAL_REPAIRS = 1;

const PARAM_TYPES = ["date", "dateRange", "number", "text", "select"] as const;

// Strict structured output rejects optional fields and oneOf, so the model
// fills this flat draft and ParamDef checks the result.
const ProposalDraft = z.object({
  inputs: z.array(
    z.object({
      defaultValue: z.string(),
      label: z.string(),
      max: z.number().nullable(),
      min: z.number().nullable(),
      name: z.string(),
      options: z.array(z.string()).nullable(),
      optionsSql: z.string().nullable(),
      type: z.enum(PARAM_TYPES),
    })
  ),
  template: z.string(),
});

type ProposalDraftValue = z.infer<typeof ProposalDraft>;
type DraftInput = ProposalDraftValue["inputs"][number];

export interface ProposeParamsInput {
  sql: string;
  prompt: string;
  dialect: DialectType;
  model: LanguageModel;
  now: Date;
  signal: AbortSignal;
}

class ProposalRejected extends Error {}

const reject = (message: string): never => {
  throw new ProposalRejected(message);
};

const EXAMPLE = `Example. Query:
select status, count(*) as orders from orders
where created_at >= date '2026-01-01' and created_at < date '2026-04-01' and status = 'paid' and total > 100
group by 1 limit 50

Reply:
{"template": "select status, count(*) as orders from orders\\nwhere created_at >= {{period.from}}::date and created_at < {{period.to}}::date and status = {{status}} and total > {{min_total}}\\ngroup by 1 limit 50",
 "inputs": [
  {"name": "period", "type": "dateRange", "label": "Period", "defaultValue": "2026-01-01..2026-04-01", "min": null, "max": null, "options": null, "optionsSql": null},
  {"name": "status", "type": "select", "label": "Status", "defaultValue": "paid", "min": null, "max": null, "options": null, "optionsSql": "select distinct status from orders order by 1 limit 200"},
  {"name": "min_total", "type": "number", "label": "Minimum total", "defaultValue": "100", "min": 0, "max": null, "options": null, "optionsSql": null}
 ]}`;

export const proposeParamsSystemPrompt = (
  dialect: DialectType,
  today: Date
): string => `You turn one read-only ${DIALECT_LABELS[dialect]} query into a reusable template with typed inputs.

Lift at most ${MAX_PROPOSED_PARAMS} literal values a person would plausibly change between runs, and keep every other character of the query the same:
- Date bounds become one "dateRange" input. Replace the lower bound literal with {{name.from}} and the upper bound with {{name.to}}; the range is half-open (>= from and < to). Set defaultValue to "YYYY-MM-DD..YYYY-MM-DD" with the query's bounds, or to the closest preset (${RANGE_PRESETS.join(", ")}) when the query has only a lower bound.
- A single date becomes a "date" input written as {{name}}, with defaultValue set to YYYY-MM-DD or a preset (${DATE_PRESETS.join(", ")}). Only dateRange inputs have .from and .to.
- A category filter such as a region or a status becomes a "select" input. Set optionsSql to a read-only query that returns the distinct values in one column, ordered, at most 200 rows.
- Limits and thresholds become "number" inputs, with min and max when obvious.
- Free text such as a search term becomes a "text" input.

Rules:
- An input is written exactly {{name}}, or {{name.from}} / {{name.to}} for a dateRange. Nothing else goes inside the braces.
- "name" is a new lowercase snake_case identifier that describes the value, such as period, status or row_limit; it is never the type. "type" is one of date, dateRange, number, text, select.
- Every input you list must appear in the template, and every {{name}} in the template must be listed.
- Replace only the literal itself. Keep a typed literal's keyword or cast next to the input, for example date '2026-01-01' becomes {{period.from}}::date, never just {{period.from}}.
- Never replace column names, table names, keywords, operators or expressions such as current_date - interval '7 days'.
- Never put an input inside quotes or a comment.
- Set defaultValue to the literal's current value, as a string, so the template returns the same result by default.
- Use null for fields that don't apply. When nothing is worth lifting, return the query unchanged with no inputs.
- Today is ${today.toISOString().slice(0, 10)}.

${EXAMPLE}`;

export const repairProposal = (reason: string): string =>
  `That template was rejected: ${reason}
Fix it and reply with the whole template and inputs again, following the same rules.`;

const RANGE_SEPARATOR = "..";

const rangeDefault = (value: string): ParamDef["default"] => {
  const preset = RangePreset.safeParse(value);
  if (preset.success) {
    return preset.data;
  }
  const [from = "", to = ""] = value.split(RANGE_SEPARATOR);
  return { from: from.trim(), to: to.trim() };
};

const candidateFor = (input: DraftInput): unknown => {
  const base = { label: input.label, name: input.name };
  switch (input.type) {
    case "date": {
      return { ...base, default: input.defaultValue, type: "date" };
    }
    case "dateRange": {
      return {
        ...base,
        default: rangeDefault(input.defaultValue),
        type: "dateRange",
      };
    }
    case "number": {
      return {
        ...base,
        default: Number(input.defaultValue),
        type: "number",
        ...(input.min === null ? {} : { min: input.min }),
        ...(input.max === null ? {} : { max: input.max }),
      };
    }
    case "select": {
      if (!(input.options?.length || input.optionsSql)) {
        return { ...base, default: input.defaultValue, type: "text" };
      }
      return {
        ...base,
        default: input.defaultValue,
        type: "select",
        ...(input.options ? { options: input.options } : {}),
        ...(input.optionsSql ? { optionsSql: input.optionsSql } : {}),
      };
    }
    default: {
      return { ...base, default: input.defaultValue, type: "text" };
    }
  }
};

const toParamDef = (input: DraftInput): ParamDef => {
  const parsed = ParamDef.safeParse(candidateFor(input));
  if (!parsed.success) {
    return reject(
      `The proposed input "${input.name}" isn't valid: ${parsed.error.issues[0]?.message ?? "unknown problem"}.`
    );
  }
  return parsed.data;
};

const STRING_LITERAL = /^['$]/;
const TYPED_LITERAL = /\b(?:date|timestamp|timestamptz|time|interval)\s+\?/gi;
const POSTFIX_CAST = /\?\s*::\s*[a-z_]\w*(?:\s*\([^)]*\))?/gi;
const CAST_CALL = /\bcast\s*\(\s*\?\s+as\s+[a-z_]\w*(?:\s*\([^)]*\))?\s*\)/gi;
const WHITESPACE = /\s+/g;

// Masks every literal and input to "?" so two statements compare equal only
// when they differ in nothing but values.
export const sqlShape = (sql: string, dialect: DialectType): string =>
  tokenizeSqlTemplate(sql, dialect)
    .map((segment) => {
      switch (segment.kind) {
        case "placeholder": {
          return "?";
        }
        case "comment": {
          return " ";
        }
        case "literal": {
          return STRING_LITERAL.test(segment.text) ? "?" : segment.text;
        }
        default: {
          return segment.text.replaceAll(NUMBER_LITERAL, "?");
        }
      }
    })
    .join("")
    .replaceAll(TYPED_LITERAL, "?")
    .replaceAll(CAST_CALL, "?")
    .replaceAll(POSTFIX_CAST, "?")
    .replaceAll(WHITESPACE, " ")
    .trim()
    .toLowerCase();

const shapeOf = (sql: string, dialect: DialectType, what: string): string => {
  try {
    return sqlShape(sql, dialect);
  } catch (error) {
    return reject(`${what}: ${DbError.fromUnknown(error).message}`);
  }
};

const assertGuarded = (sql: string, dialect: DialectType, what: string) => {
  const verdict = assertReadOnly(sql, dialect);
  if (!verdict.ok) {
    reject(`${what} isn't read-only: ${verdict.reason}`);
  }
};

const verifyProposal = (
  original: string,
  template: string,
  params: ParamDef[],
  dialect: DialectType,
  now: Date
): void => {
  if (params.length > MAX_PROPOSED_PARAMS) {
    reject(`Proposed ${params.length} inputs; at most ${MAX_PROPOSED_PARAMS}.`);
  }
  if (new Set(params.map((param) => param.name)).size !== params.length) {
    reject("Two proposed inputs share a name.");
  }
  const defaults = Object.fromEntries(
    params.map((param) => [
      param.name,
      toTemplateValue(param, param.default, now),
    ])
  );
  try {
    compileSqlTemplate(template, defaults, dialect);
  } catch (error) {
    reject(DbError.fromUnknown(error).message);
  }
  assertGuarded(
    maskTemplateInputs(template, dialect, "NULL"),
    dialect,
    "The template"
  );
  for (const param of params) {
    if (param.type === "select" && param.optionsSql) {
      assertGuarded(param.optionsSql, dialect, `Options for ${param.label}`);
    }
  }
  if (
    shapeOf(template, dialect, "The template") !==
    shapeOf(original, dialect, "The query")
  ) {
    reject("The template changes more than literal values.");
  }
};

const askModel = async (
  input: ProposeParamsInput,
  messages: ModelMessage[]
): Promise<ProposalDraftValue> => {
  const timeout = AbortSignal.timeout(PROPOSE_TIMEOUT_MS);
  const { output } = await generateText({
    abortSignal: AbortSignal.any([input.signal, timeout]),
    messages,
    model: input.model,
    output: Output.object({ schema: ProposalDraft }),
    system: proposeParamsSystemPrompt(input.dialect, input.now),
  });
  return output;
};

const accept = (
  input: ProposeParamsInput,
  draft: ProposalDraftValue
): ProposeParamsResult => {
  const params = restoreDefaults(
    input.sql,
    draft.template,
    draft.inputs.map(toParamDef),
    input.dialect
  );
  verifyProposal(input.sql, draft.template, params, input.dialect, input.now);
  return { params, template: draft.template };
};

// One repair round: a rejection reason usually names a syntax slip the model
// fixes on its own. The checks themselves never relax.
export const proposeParams = async (
  input: ProposeParamsInput
): Promise<ProposeParamsResult> => {
  const messages: ModelMessage[] = [
    {
      content: JSON.stringify({ question: input.prompt, sql: input.sql }),
      role: "user",
    },
  ];
  let rejection = "";
  for (let attempt = 0; attempt <= MAX_PROPOSAL_REPAIRS; attempt += 1) {
    let draft: ProposalDraftValue;
    try {
      draft = await askModel(input, messages);
    } catch (error) {
      const { message, suggestion } = classifyAIError(error);
      return { error: `${message} ${suggestion}` };
    }
    try {
      return accept(input, draft);
    } catch (error) {
      if (!(error instanceof ProposalRejected)) {
        throw error;
      }
      rejection = error.message;
      messages.push(
        { content: JSON.stringify(draft), role: "assistant" },
        { content: repairProposal(rejection), role: "user" }
      );
    }
  }
  return { error: rejection };
};
