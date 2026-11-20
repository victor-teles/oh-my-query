import type { BindValue, SchemaInfo, TabularResult } from "@oh-my-query/core";
import type { AskErrorCode, AskEvent, RefineContext } from "@oh-my-query/rpc";
import type { LanguageModel, ModelMessage } from "ai";

import { redactPii } from "@oh-my-query/core/client";
import { chainPrompt } from "@oh-my-query/rpc";
import { streamText } from "ai";

import type { QueryEngine } from "./query-engine.ts";
import type { RunOutcome } from "./run-query.ts";
import type { RedactOptions } from "./schema-prompt.ts";

import { classifyAIError } from "./ai-errors.ts";
import { presentCard } from "./present.ts";
import { refineMessages, relevanceText } from "./refine.ts";
import {
  AskFailure,
  cancelled,
  executeWithTimeout,
  lineCount,
  resultEvent,
  runToCompletion,
  throwIfAborted,
} from "./run-query.ts";
import { selectRelevantSchema } from "./schema-filter.ts";
import { coalesceText, createFenceStripper } from "./sql-stream.ts";

export const ASK_MAX_ROWS = 2000;
const MAX_REPAIRS = 2;

export interface AskPorts {
  model: LanguageModel;
  loadSchema(): Promise<SchemaInfo>;
  execute(
    sql: string,
    signal: AbortSignal,
    params?: BindValue[]
  ): Promise<TabularResult>;
  engine: QueryEngine;
  connectionLabel: string;
  redact: RedactOptions;
  now(): Date;
}

const AI_ERROR_CODES = {
  auth: "AI_AUTH",
  context_length: "AI_NETWORK",
  model_not_found: "AI_AUTH",
  network: "AI_NETWORK",
  provider_error: "AI_NETWORK",
  rate_limit: "AI_RATE_LIMIT",
  unknown: "AI_NETWORK",
} as const satisfies Record<string, AskErrorCode>;

const aiFailure = (error: unknown): AskFailure => {
  const classified = classifyAIError(error);
  return new AskFailure(
    AI_ERROR_CODES[classified.type],
    `${classified.message} ${classified.suggestion}`
  );
};

async function* modelText(
  model: LanguageModel,
  system: string,
  messages: ModelMessage[],
  signal: AbortSignal
): AsyncGenerator<string> {
  const result = streamText({ abortSignal: signal, messages, model, system });
  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      yield part.text;
    } else if (part.type === "error") {
      throw part.error;
    } else if (part.type === "abort") {
      throw cancelled();
    }
  }
}

async function* streamSql(
  ports: AskPorts,
  system: string,
  messages: ModelMessage[],
  signal: AbortSignal
): AsyncGenerator<AskEvent, string> {
  const stripper = createFenceStripper();
  let sql = "";
  try {
    const deltas = coalesceText(
      stripText(modelText(ports.model, system, messages, signal), stripper)
    );
    for await (const text of deltas) {
      sql += text;
      yield { text, type: "sqlDelta" };
    }
  } catch (error) {
    throwIfAborted(signal);
    throw error instanceof AskFailure ? error : aiFailure(error);
  }
  const rest = stripper.flush();
  if (rest) {
    sql += rest;
    yield { text: rest, type: "sqlDelta" };
  }
  yield {
    dialect: ports.engine.language,
    lines: lineCount(sql),
    sql,
    type: "sqlDone",
  };
  return sql;
}

async function* stripText(
  source: AsyncIterable<string>,
  stripper: ReturnType<typeof createFenceStripper>
): AsyncGenerator<string> {
  for await (const chunk of source) {
    const text = stripper.push(chunk);
    if (text) {
      yield text;
    }
  }
}

const redactFor = (ports: AskPorts, text: string): string =>
  ports.redact.enabled
    ? redactPii(text, { customPatterns: ports.redact.customPatterns }).text
    : text;

async function* loadSchemaText(
  relevance: string,
  ports: AskPorts
): AsyncGenerator<AskEvent, string> {
  yield {
    detail: `Reading the ${ports.connectionLabel} schema`,
    phase: "schema",
    type: "phase",
  };
  const { schema, omittedTables } = selectRelevantSchema(
    await ports.loadSchema(),
    relevance
  );
  return ports.engine.formatSchema(schema, {
    omittedTables,
    redact: ports.redact,
  });
}

async function* writeAndRunSql(
  messages: ModelMessage[],
  ports: AskPorts,
  schemaText: string,
  signal: AbortSignal
): AsyncGenerator<
  AskEvent,
  { sql: string; outcome: RunOutcome & { ok: true } }
> {
  const { engine } = ports;
  const system = engine.systemPrompt({
    connectionLabel: ports.connectionLabel,
    schemaText,
    today: ports.now(),
  });
  yield { detail: engine.writingDetail, phase: "sql", type: "phase" };
  for (let attempt = 0; ; attempt += 1) {
    const sql = yield* streamSql(ports, system, messages, signal);
    const verdict = engine.guard(sql);
    if (!verdict.ok) {
      throw new AskFailure("NOT_READ_ONLY", verdict.reason, sql);
    }

    yield {
      detail: `Read only on ${ports.connectionLabel}`,
      phase: "run",
      type: "phase",
    };
    const outcome = await executeWithTimeout(ports.execute, sql, signal);
    if (outcome.ok) {
      return { outcome, sql };
    }
    if (attempt >= MAX_REPAIRS) {
      throw new AskFailure("QUERY_FAILED", outcome.message, sql);
    }

    yield { reason: outcome.message, type: "sqlReset" };
    yield { detail: "Fixing the query", phase: "sql", type: "phase" };
    messages.push(
      { content: sql, role: "assistant" },
      {
        content: engine.repairInstruction(redactFor(ports, outcome.message)),
        role: "user",
      }
    );
  }
}

interface AskTurn {
  relevance: string;
  messages: ModelMessage[];
  presentPrompt: string;
  previous?: RefineContext["spec"];
}

const turnOf = (
  prompt: string,
  engine: QueryEngine,
  refine?: RefineContext
): AskTurn =>
  refine
    ? {
        messages: refineMessages(refine, prompt, engine),
        presentPrompt: chainPrompt(refine.turns, prompt),
        previous: refine.spec,
        relevance: relevanceText(refine, prompt),
      }
    : {
        messages: [{ content: prompt, role: "user" }],
        presentPrompt: prompt,
        relevance: prompt,
      };

async function* pipeline(
  turn: AskTurn,
  ports: AskPorts,
  signal: AbortSignal
): AsyncGenerator<AskEvent> {
  const schemaText = yield* loadSchemaText(turn.relevance, ports);
  throwIfAborted(signal);
  const { sql, outcome } = yield* writeAndRunSql(
    turn.messages,
    ports,
    schemaText,
    signal
  );
  const { result } = outcome;
  yield resultEvent(outcome);

  yield { detail: "Shaping the result", phase: "present", type: "phase" };
  const card = await presentCard({
    language: ports.engine.language,
    model: ports.model,
    previous: turn.previous,
    prompt: turn.presentPrompt,
    redact: ports.redact,
    result,
    signal,
    sql,
  });
  throwIfAborted(signal);
  yield { source: card.source, spec: card.spec, type: "card" };
}

export const runAsk = (
  prompt: string,
  ports: AskPorts,
  signal: AbortSignal,
  refine?: RefineContext
): AsyncGenerator<AskEvent> =>
  runToCompletion(
    pipeline(turnOf(prompt, ports.engine, refine), ports, signal),
    "schema",
    signal
  );
