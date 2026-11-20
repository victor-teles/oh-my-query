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

export const repairInstruction = (errorMessage: string): string =>
  `That query failed with this error:
${errorMessage}

Write a corrected query for the same question. Follow the same rules and reply with SQL only.`;

export const refineInstruction = (
  followUp: string,
  previous: { title: string; view: string }
): string =>
  `Change that query to answer this follow-up: ${followUp}
Keep everything the follow-up does not change: filters, time range, grouping and limits. The previous answer was a ${previous.view} titled "${previous.title}".
Follow the same rules and reply with SQL only.`;

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
