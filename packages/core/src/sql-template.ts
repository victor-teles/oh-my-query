import type { BindValue, DialectType } from "./types.ts";

import { DbError } from "./error.ts";

export const DATE_PRESETS = [
  "today",
  "yesterday",
  "startOfWeek",
  "startOfMonth",
  "startOfQuarter",
  "startOfYear",
] as const;

export const RANGE_PRESETS = [
  "last7d",
  "last30d",
  "thisMonth",
  "lastMonth",
  "thisQuarter",
  "lastQuarter",
  "ytd",
  "last12m",
] as const;

export type DatePreset = (typeof DATE_PRESETS)[number];
export type RangePreset = (typeof RANGE_PRESETS)[number];

export interface IsoRange {
  from: string;
  to: string;
}

export type TemplateValue =
  | { kind: "date"; value: string }
  | { kind: "dateRange"; from: string; to: string }
  | { kind: "number"; value: number }
  | { kind: "text"; value: string };

export type RangePart = "from" | "to";

export type TemplateSegment =
  | { kind: "code"; text: string }
  | { kind: "literal"; text: string }
  | { kind: "comment"; text: string }
  | { kind: "placeholder"; text: string; name: string; part: RangePart | null };

export interface CompiledTemplate {
  sql: string;
  params: BindValue[];
}

export type WeekStart = 0 | 1;

const PLACEHOLDER = /^\{\{\s*([a-z][a-z0-9_]{0,31})(?:\.(from|to))?\s*\}\}/;
const PLACEHOLDER_ANYWHERE =
  /\{\{\s*[a-z][a-z0-9_]{0,31}(?:\.(?:from|to))?\s*\}\}/;
const DOLLAR_TAG = /^\$([A-Za-z_]\w*)?\$/;
const IDENTIFIER_CHAR = /\w/;

const templateError = (message: string): DbError =>
  new DbError("INVALID_TEMPLATE", message);

const backslashEscapes = (dialect: DialectType): boolean =>
  dialect === "mysql" || dialect === "clickhouse";

const closingQuote = (
  sql: string,
  start: number,
  quote: string,
  escapes: boolean
): number => {
  let index = start + 1;
  while (index < sql.length) {
    const char = sql[index];
    if (escapes && char === "\\") {
      index += 2;
      continue;
    }
    if (char === quote) {
      if (sql[index + 1] !== quote) {
        return index + 1;
      }
      index += 2;
      continue;
    }
    index += 1;
  }
  return -1;
};

const dollarQuoteEnd = (sql: string, start: number): number | null => {
  if (start > 0 && IDENTIFIER_CHAR.test(sql[start - 1] ?? "")) {
    return null;
  }
  const tag = DOLLAR_TAG.exec(sql.slice(start))?.[0];
  if (!tag) {
    return null;
  }
  const close = sql.indexOf(tag, start + tag.length);
  return close === -1 ? -1 : close + tag.length;
};

const lineEnd = (sql: string, start: number): number => {
  const end = sql.indexOf("\n", start);
  return end === -1 ? sql.length : end;
};

interface Skipped {
  kind: "literal" | "comment";
  end: number;
}

const skippedAt = (
  sql: string,
  index: number,
  dialect: DialectType
): Skipped | null => {
  const char = sql[index];
  const next = sql[index + 1];
  if (char === "-" && next === "-") {
    return { end: lineEnd(sql, index), kind: "comment" };
  }
  if (char === "#" && dialect === "mysql") {
    return { end: lineEnd(sql, index), kind: "comment" };
  }
  if (char === "/" && next === "*") {
    const close = sql.indexOf("*/", index + 2);
    return { end: close === -1 ? -1 : close + 2, kind: "comment" };
  }
  if (char === "'" || char === '"' || char === "`") {
    const escapes = char !== "`" && backslashEscapes(dialect);
    return { end: closingQuote(sql, index, char, escapes), kind: "literal" };
  }
  if (char === "[" && dialect === "tsql") {
    const close = sql.indexOf("]", index + 1);
    return { end: close === -1 ? -1 : close + 1, kind: "literal" };
  }
  if (char === "$" && (dialect === "postgresql" || dialect === "duckdb")) {
    const end = dollarQuoteEnd(sql, index);
    return end === null ? null : { end, kind: "literal" };
  }
  return null;
};

export const tokenizeSqlTemplate = (
  template: string,
  dialect: DialectType
): TemplateSegment[] => {
  const segments: TemplateSegment[] = [];
  let code = "";
  const flushCode = () => {
    if (code) {
      segments.push({ kind: "code", text: code });
      code = "";
    }
  };

  let index = 0;
  while (index < template.length) {
    const skipped = skippedAt(template, index, dialect);
    if (skipped) {
      if (skipped.end === -1) {
        throw templateError("The SQL has an unterminated string or comment.");
      }
      const text = template.slice(index, skipped.end);
      if (PLACEHOLDER_ANYWHERE.test(text)) {
        throw templateError(
          "Inputs can't sit inside a quoted string or a comment."
        );
      }
      flushCode();
      segments.push({ kind: skipped.kind, text });
      index = skipped.end;
      continue;
    }
    if (template.startsWith("{{", index)) {
      const match = PLACEHOLDER.exec(template.slice(index));
      if (!match?.[1]) {
        throw templateError(
          `Malformed input near "${template.slice(index, index + 24)}".`
        );
      }
      flushCode();
      segments.push({
        kind: "placeholder",
        name: match[1],
        part: (match[2] as RangePart | undefined) ?? null,
        text: match[0],
      });
      index += match[0].length;
      continue;
    }
    code += template[index];
    index += 1;
  }
  flushCode();
  return segments;
};

type Placeholder = Extract<TemplateSegment, { kind: "placeholder" }>;

const placeholdersOf = (segments: TemplateSegment[]): Placeholder[] =>
  segments.filter(
    (segment): segment is Placeholder => segment.kind === "placeholder"
  );

export const templateInputNames = (
  template: string,
  dialect: DialectType
): string[] => [
  ...new Set(
    placeholdersOf(tokenizeSqlTemplate(template, dialect)).map((p) => p.name)
  ),
];

export const maskTemplateInputs = (
  template: string,
  dialect: DialectType,
  mask: string
): string =>
  tokenizeSqlTemplate(template, dialect)
    .map((segment) => (segment.kind === "placeholder" ? mask : segment.text))
    .join("");

const boundValue = (
  placeholder: Placeholder,
  values: Readonly<Record<string, TemplateValue>>
): TemplateValue & { kind: "date" | "number" | "text" } => {
  const input = values[placeholder.name];
  if (!input) {
    throw templateError(`Unknown input "${placeholder.name}".`);
  }
  if (input.kind === "dateRange") {
    if (!placeholder.part) {
      throw templateError(
        `Use {{${placeholder.name}.from}} or {{${placeholder.name}.to}} for a date range.`
      );
    }
    return { kind: "date", value: input[placeholder.part] };
  }
  if (placeholder.part) {
    throw templateError(
      `Only date ranges have .${placeholder.part}; "${placeholder.name}" is a ${input.kind}.`
    );
  }
  return input;
};

const CLICKHOUSE_TYPES = {
  date: "Date",
  number: "Float64",
  text: "String",
} as const;

const markerFor = (
  dialect: DialectType,
  position: number,
  kind: keyof typeof CLICKHOUSE_TYPES
): string => {
  switch (dialect) {
    case "postgresql": {
      return `$${position}`;
    }
    case "mysql":
    case "sqlite":
    case "duckdb": {
      return "?";
    }
    case "tsql": {
      return `@p${position}`;
    }
    case "clickhouse": {
      return `{p${position}:${CLICKHOUSE_TYPES[kind]}}`;
    }
    default: {
      throw new DbError(
        "UNSUPPORTED_ENGINE",
        `Inputs aren't supported for ${dialect} yet.`
      );
    }
  }
};

const repeatsMarkers = (dialect: DialectType): boolean =>
  dialect === "mysql" || dialect === "sqlite" || dialect === "duckdb";

const NATIVE_MARKERS: Partial<Record<DialectType, RegExp>> = {
  clickhouse: /\{\s*\w+\s*:/,
  duckdb: /\?|\$\d/,
  mysql: /\?/,
  postgresql: /\$\d/,
  sqlite: /\?|[:@$][A-Za-z_]/,
  tsql: /@p\d/i,
};

// A bare marker in the SQL would shift every bound value one slot over.
const assertNoNativeMarkers = (
  segments: TemplateSegment[],
  dialect: DialectType
): void => {
  const marker = NATIVE_MARKERS[dialect];
  const code = segments.filter((segment) => segment.kind === "code");
  if (marker && code.some((segment) => marker.test(segment.text))) {
    throw templateError(
      "The SQL already contains a bind marker; use {{name}} inputs instead."
    );
  }
};

const assertEveryValueUsed = (
  placeholders: Placeholder[],
  values: Readonly<Record<string, TemplateValue>>
): void => {
  const used = new Set(placeholders.map((placeholder) => placeholder.name));
  const unused = Object.keys(values).filter((name) => !used.has(name));
  if (unused.length > 0) {
    throw templateError(`Unused input: ${unused.join(", ")}.`);
  }
};

export const compileSqlTemplate = (
  template: string,
  values: Readonly<Record<string, TemplateValue>>,
  dialect: DialectType
): CompiledTemplate => {
  const segments = tokenizeSqlTemplate(template, dialect);
  assertNoNativeMarkers(segments, dialect);
  assertEveryValueUsed(placeholdersOf(segments), values);

  const params: BindValue[] = [];
  const positions = new Map<string, number>();
  const sql = segments
    .map((segment) => {
      if (segment.kind !== "placeholder") {
        return segment.text;
      }
      const bound = boundValue(segment, values);
      const key = segment.part
        ? `${segment.name}.${segment.part}`
        : segment.name;
      const known = positions.get(key);
      if (known !== undefined && !repeatsMarkers(dialect)) {
        return markerFor(dialect, known, bound.kind);
      }
      params.push(bound.value);
      positions.set(key, params.length);
      return markerFor(dialect, params.length, bound.kind);
    })
    .join("");
  return { params, sql };
};

const pad = (value: number): string => String(value).padStart(2, "0");

export const formatIsoDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const day = (year: number, month: number, date: number): string =>
  formatIsoDate(new Date(year, month, date));

const quarterStart = (month: number): number => month - (month % 3);

export const resolveDatePreset = (
  preset: DatePreset,
  now: Date,
  weekStart: WeekStart = 1
): string => {
  const year = now.getFullYear();
  const month = now.getMonth();
  const date = now.getDate();
  switch (preset) {
    case "today": {
      return day(year, month, date);
    }
    case "yesterday": {
      return day(year, month, date - 1);
    }
    case "startOfWeek": {
      const offset = (now.getDay() - weekStart + 7) % 7;
      return day(year, month, date - offset);
    }
    case "startOfMonth": {
      return day(year, month, 1);
    }
    case "startOfQuarter": {
      return day(year, quarterStart(month), 1);
    }
    case "startOfYear": {
      return day(year, 0, 1);
    }
    default: {
      throw templateError(`Unknown date preset ${preset satisfies never}.`);
    }
  }
};

export const resolvePreset = (preset: RangePreset, now: Date): IsoRange => {
  const year = now.getFullYear();
  const month = now.getMonth();
  const tomorrow = day(year, month, now.getDate() + 1);
  switch (preset) {
    case "last7d": {
      return { from: day(year, month, now.getDate() - 6), to: tomorrow };
    }
    case "last30d": {
      return { from: day(year, month, now.getDate() - 29), to: tomorrow };
    }
    case "thisMonth": {
      return { from: day(year, month, 1), to: day(year, month + 1, 1) };
    }
    case "lastMonth": {
      return { from: day(year, month - 1, 1), to: day(year, month, 1) };
    }
    case "thisQuarter": {
      const start = quarterStart(month);
      return { from: day(year, start, 1), to: day(year, start + 3, 1) };
    }
    case "lastQuarter": {
      const start = quarterStart(month);
      return { from: day(year, start - 3, 1), to: day(year, start, 1) };
    }
    case "ytd": {
      return { from: day(year, 0, 1), to: tomorrow };
    }
    case "last12m": {
      return { from: day(year, month - 11, 1), to: day(year, month + 1, 1) };
    }
    default: {
      throw templateError(`Unknown range preset ${preset satisfies never}.`);
    }
  }
};
