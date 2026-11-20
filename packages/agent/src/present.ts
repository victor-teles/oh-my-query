import type { QueryLanguage } from "@conch/core";
import type { LanguageModel } from "ai";

import { isSqlDialect, redactPii } from "@conch/core/client";
import {
  CARD_SPEC_VERSION,
  CardSpec,
  CHART_MARKS,
  COLUMN_FORMAT_KINDS,
} from "@conch/rpc";
import { generateText, Output } from "ai";
import { z } from "zod";

import type { ColumnStats, TabularData } from "./column-stats.ts";
import type { RedactOptions } from "./schema-prompt.ts";

import { checkCardAgainstResult } from "./check-card-spec.ts";
import { computeColumnStats } from "./column-stats.ts";
import {
  clip,
  inferCardSpec,
  SUBTITLE_MAX,
  TITLE_MAX,
} from "./infer-card-spec.ts";
import { PRESENT_SYSTEM_PROMPT } from "./prompts.ts";

export const PRESENT_TIMEOUT_MS = 8000;
export const SAMPLE_ROWS = 20;
const INSIGHT_MAX = 280;

// Strict structured output (OpenAI, Anthropic) rejects optional fields, records
// and oneOf, so the model fills this flat anyOf draft, then CardSpec checks it.
const CardDraft = z.object({
  formats: z.array(
    z.object({
      column: z.string(),
      currency: z.string().nullable(),
      kind: z.enum(COLUMN_FORMAT_KINDS),
    })
  ),
  insight: z.string().nullable(),
  subtitle: z.string().nullable(),
  title: z.string(),
  view: z.union([
    z.object({
      groupBy: z.string().nullable(),
      kind: z.literal("chart"),
      mark: z.enum(CHART_MARKS),
      stacked: z.boolean(),
      x: z.string(),
      y: z.array(z.string()),
    }),
    z.object({ kind: z.literal("pie"), label: z.string(), value: z.string() }),
    z.object({
      delta: z.string().nullable(),
      kind: z.literal("kpi"),
      label: z.string().nullable(),
      value: z.string(),
    }),
    z.object({
      columns: z.array(z.string()).nullable(),
      kind: z.literal("table"),
    }),
  ]),
});

type CardDraft = z.infer<typeof CardDraft>;

const withoutNulls = <T extends Record<string, unknown>>(value: T) =>
  Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== null)
  );

const withoutRedundantGroup = (view: CardDraft["view"]): CardDraft["view"] =>
  view.kind === "chart" && view.groupBy === view.x
    ? { ...view, groupBy: null }
    : view;

const MINOR_UNITS = /_cents$/i;

// Cents formatted as currency would read 100× too high, so that one choice
// is dropped rather than discarding the model's whole card.
const usableFormats = (formats: CardDraft["formats"]) =>
  formats.filter(
    (format) => !(format.kind === "currency" && MINOR_UNITS.test(format.column))
  );

const draftToCandidate = (draft: CardDraft): unknown => ({
  formats: Object.fromEntries(
    usableFormats(draft.formats).map(({ column, ...format }) => [
      column,
      withoutNulls(format),
    ])
  ),
  ...withoutNulls({
    insight:
      draft.insight && draft.insight.length <= INSIGHT_MAX
        ? draft.insight
        : null,
    subtitle: draft.subtitle && clip(draft.subtitle, SUBTITLE_MAX),
    title: clip(draft.title, TITLE_MAX),
  }),
  version: CARD_SPEC_VERSION,
  view: withoutNulls(withoutRedundantGroup(draft.view)),
});

export interface PresentInput {
  model: LanguageModel;
  language: QueryLanguage;
  prompt: string;
  sql: string;
  result: TabularData & { rowCount: number };
  redact: RedactOptions;
  signal: AbortSignal;
  previous?: CardSpec;
}

export interface PresentedCard {
  spec: CardSpec;
  source: "model" | "inferred";
}

const describeResult = (input: PresentInput, stats: ColumnStats[]): string => {
  const previousCard = input.previous
    ? { title: input.previous.title, view: input.previous.view }
    : undefined;
  const language = isSqlDialect(input.language)
    ? {}
    : { language: input.language };
  const payload = JSON.stringify(
    {
      ...language,
      columns: input.result.columns,
      previousCard,
      question: input.prompt,
      rowCount: input.result.rowCount,
      sampleRows: input.result.rows.slice(0, SAMPLE_ROWS),
      sql: input.sql,
      stats,
    },
    null,
    1
  );
  return input.redact.enabled
    ? redactPii(payload, { customPatterns: input.redact.customPatterns }).text
    : payload;
};

const askModelForSpec = async (
  input: PresentInput,
  stats: ColumnStats[]
): Promise<CardSpec | null> => {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), PRESENT_TIMEOUT_MS);
  try {
    const { output } = await generateText({
      abortSignal: AbortSignal.any([input.signal, timeout.signal]),
      model: input.model,
      output: Output.object({ schema: CardDraft }),
      prompt: describeResult(input, stats),
      system: PRESENT_SYSTEM_PROMPT,
    });
    const parsed = CardSpec.safeParse(draftToCandidate(output));
    if (!parsed.success) {
      return null;
    }
    const problem = checkCardAgainstResult(
      parsed.data,
      stats,
      input.result.rowCount
    );
    return problem ? null : parsed.data;
  } finally {
    clearTimeout(timer);
  }
};

export const presentCard = async (
  input: PresentInput
): Promise<PresentedCard> => {
  const stats = computeColumnStats(input.result);
  let spec: CardSpec | null = null;
  try {
    spec = await askModelForSpec(input, stats);
  } catch (error) {
    if (input.signal.aborted) {
      throw error;
    }
  }
  if (spec) {
    return { source: "model", spec };
  }
  return {
    source: "inferred",
    spec: inferCardSpec(input.result, { prompt: input.prompt, sql: input.sql }),
  };
};
