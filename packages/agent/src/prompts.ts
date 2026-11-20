import type { DialectType } from "@conch/core";

import { DIALECT_LABELS } from "./schema-prompt.ts";

export const ASK_ROW_LIMIT_HINT = 500;

export interface SqlPromptInput {
  dialect: DialectType;
  connectionLabel: string;
  schemaText: string;
  today: Date;
}

export const sqlSystemPrompt = ({
  dialect,
  connectionLabel,
  schemaText,
  today,
}: SqlPromptInput): string => {
  const label = DIALECT_LABELS[dialect];
  return `You write one read-only ${label} query that answers a question about the "${connectionLabel}" database.

Rules:
- Reply with SQL only: no prose, no Markdown, no code fences.
- Start with a one-line comment that describes the result, for example: -- Monthly recurring revenue by region in 2026
- Write exactly one SELECT statement (a WITH … SELECT is fine). Never modify data or schema, and never use SELECT … INTO.
- Use ${label} syntax and only the tables and columns listed below.
- Alias every output column in snake_case, and never use SELECT *.
- Return money in major units: divide amounts stored in minor units (columns like *_cents) by 100.0 and alias them without the _cents suffix.
- For a time series, put the time bucket in the first column and order by it ascending.
- Return at most ${ASK_ROW_LIMIT_HINT} rows unless the question asks for more.
- Today is ${today.toISOString().slice(0, 10)}.

Schema:
${schemaText}`;
};

export interface ReplyFormat {
  noun: string;
  format: string;
}

export const SQL_REPLY: ReplyFormat = { format: "SQL", noun: "query" };
export const MONGO_REPLY: ReplyFormat = { format: "JSON", noun: "pipeline" };
export const REDIS_REPLY: ReplyFormat = { format: "JSON", noun: "plan" };

export const repairInstructionFor =
  ({ noun, format }: ReplyFormat) =>
  (errorMessage: string): string =>
    `That ${noun} failed with this error:
${errorMessage}

Write a corrected ${noun} for the same question. Follow the same rules and reply with ${format} only.`;

export const repairInstruction = repairInstructionFor(SQL_REPLY);

export interface PreviousAnswer {
  title: string;
  view: string;
}

export const refineInstructionFor =
  ({ noun, format }: ReplyFormat) =>
  (followUp: string, previous: PreviousAnswer): string =>
    `Change that ${noun} to answer this follow-up: ${followUp}
Keep everything the follow-up does not change: filters, time range, grouping and limits. The previous answer was a ${previous.view} titled "${previous.title}".
Follow the same rules and reply with ${format} only.`;

export const refineInstruction = refineInstructionFor(SQL_REPLY);

export interface EnginePromptInput {
  connectionLabel: string;
  schemaText: string;
  today: Date;
}

const isoDay = (today: Date): string => today.toISOString().slice(0, 10);

export const mongoSystemPrompt = (
  { connectionLabel, schemaText, today }: EnginePromptInput,
  stages: readonly string[]
): string => `You write one read-only MongoDB aggregation that answers a question about the "${connectionLabel}" database.

Rules:
- Reply with JSON only: no prose, no Markdown, no code fences. Use this shape: {"description": "<one line describing the result>", "collection": "<name>", "pipeline": [ … ]}
- Indent the JSON with two spaces.
- Use only these stages: ${stages.join(", ")}.
- Never use $out, $merge, $function, $accumulator or $where.
- Use only the collections and fields listed below.
- Write dates as {"$date": "2026-01-01T00:00:00Z"} and use "$$NOW" for now.
- End with a $project so every output field is a flat scalar named in snake_case.
- For a time series, put the time bucket first and sort by it ascending.
- Return at most ${ASK_ROW_LIMIT_HINT} documents unless the question asks for more.
- Today is ${isoDay(today)}.

Collections:
${schemaText}`;

export const redisSystemPrompt = (
  { connectionLabel, schemaText, today }: EnginePromptInput,
  commands: readonly string[]
): string => `You write one read-only Redis plan that answers a question about the "${connectionLabel}" database.

Rules:
- Reply with JSON only: no prose, no Markdown, no code fences.
- Indent the JSON with two spaces.
- A plan is one of two kinds.
  - "commands": up to 20 read commands, each a list of the command name in upper case and its arguments. Either exactly one command that reads a collection (HGETALL, SMEMBERS, LRANGE, ZRANGE, XRANGE …), or up to 20 commands that each read single values. Example: {"kind": "commands", "description": "Top 10 on the leaderboard", "commands": [["ZREVRANGE", "leaderboard", "0", "9", "WITHSCORES"]]}
  - "scan": counts or sizes keys that match a glob, grouped by key pattern, by type or not at all. measure is "count", "memory" or "ttl"; limit is 1 to 100 groups. Example: {"kind": "scan", "description": "Keys by pattern", "match": "*", "groupBy": "pattern", "measure": "count", "limit": 20}
- Use only these commands: ${commands.join(", ")}.
- Use a scan plan to count or size keys; never KEYS.
- Ranges (LRANGE, ZRANGE by rank) cover at most 2000 items, XRANGE and XREVRANGE need COUNT of at most 2000, and INFO needs one section: memory, stats, keyspace, clients or server.
- Use only the key patterns listed below.
- Today is ${isoDay(today)}.

Key patterns:
${schemaText}`;

export const PRESENT_SYSTEM_PROMPT = `You design the result card for a database question. Choose the view that answers the question best:
- "chart" with mark "bar", "line" or "area": x is one column and y lists 1 to 6 numeric columns. To split one y column into series, set groupBy to a text column with at most 6 distinct values.
- "pie" for shares of a whole, only with 8 rows or fewer.
- "kpi" for a single number; delta may name a numeric change column.
- "table" when nothing else fits.

Use only column names from the result. Add a format for columns that need one: currency (with a three-letter code), percent, integer, compact, date, month or text. Never format a column whose name ends in _cents as currency: its values are minor units.
Keep the title under 80 characters, the subtitle under 120, and the insight to one or two plain sentences under 280.
The subtitle and insight may only cite numbers that appear in the column stats. A percentage change is allowed only when computed from a column's first and last values. Never invent figures.
When previousCard is given, keep its view and formats unless the question asks for a different view or the new columns no longer fit it.
Write like a calm senior colleague: no hype, no exclamation marks.`;
