import { ast, generate, parse } from "@polyglot-sql/sdk";

import type { DialectType } from "./types.ts";

import { toPolyglotDialect } from "./polyglot-dialect.ts";

export type TimeGrain = "hour" | "day" | "week" | "month" | "quarter" | "year";

export type SqlAssumption =
  | { kind: "table"; name: string }
  | { kind: "time"; column: string; grain: TimeGrain | null }
  | { kind: "filter"; column: string | null; text: string }
  | { kind: "limit"; rows: number };

export interface SqlAssumptions {
  items: SqlAssumption[];
}

type Node = Record<string, unknown>;

interface ColumnRef {
  name: string;
  table: string | null;
}

interface SelectScope {
  select: Node;
  realTables: Map<string, string>;
}

const MAX_TABLES = 4;
const MAX_FILTERS = 4;
const MAX_ITEMS = 8;
const FILTER_CHARS = 60;

const isRecord = (value: unknown): value is Node =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const nodeOf = (value: unknown, type: string): Node | null => {
  if (!isRecord(value)) {
    return null;
  }
  const inner = value[type];
  return isRecord(inner) ? inner : null;
};

const listOf = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const identifier = (value: unknown): string | null =>
  isRecord(value) && typeof value.name === "string" ? value.name : null;

const textOf = (value: unknown): string | null => {
  const literal = nodeOf(value, "literal");
  if (literal && typeof literal.value === "string") {
    return literal.value;
  }
  const variable = nodeOf(value, "var");
  return variable && typeof variable.this === "string" ? variable.this : null;
};

const WRAPPERS = ["alias", "cast", "paren"];

const unwrap = (value: unknown): unknown => {
  for (const wrapper of WRAPPERS) {
    const inner = nodeOf(value, wrapper);
    if (inner) {
      return unwrap(inner.this);
    }
  }
  return value;
};

const columnOf = (value: unknown): ColumnRef | null => {
  const column = nodeOf(unwrap(value), "column");
  const name = column ? identifier(column.name) : null;
  if (!(column && name)) {
    return null;
  }
  return { name, table: identifier(column.table) };
};

const firstColumn = (value: unknown): ColumnRef | null => {
  const direct = columnOf(value);
  if (direct) {
    return direct;
  }
  const children = isRecord(value) ? Object.values(value) : listOf(value);
  for (const child of children) {
    const found = firstColumn(child);
    if (found) {
      return found;
    }
  }
  return null;
};

const GRAIN_WORDS: [RegExp, TimeGrain][] = [
  [/^(hour|hh)/, "hour"],
  [/^(day|dd?$|dayofyear)/, "day"],
  [/^(week|wk|ww|isoweek|iso_week)/, "week"],
  [/^(month|mm?$|mon)/, "month"],
  [/^(quarter|qq?$)/, "quarter"],
  [/^(year|yy|yyyy)/, "year"],
];

const grainOfUnit = (unit: string | null): TimeGrain | null => {
  const word = unit?.toLowerCase().trim() ?? "";
  return GRAIN_WORDS.find(([pattern]) => pattern.test(word))?.[1] ?? null;
};

const FORMAT_GRAINS: [RegExp, TimeGrain][] = [
  [/%H/, "hour"],
  [/%[dj]/, "day"],
  [/%[WVUu]/, "week"],
  [/%m/, "month"],
  [/%Y/, "year"],
];

const grainOfFormat = (format: string | null): TimeGrain | null =>
  FORMAT_GRAINS.find(([pattern]) => pattern.test(format ?? ""))?.[1] ?? null;

interface Bucket {
  column: ColumnRef;
  grain: TimeGrain | null;
}

const START_OF = /^tostartof(hour|day|week|month|quarter|year)$/;

const bucketGrain = (name: string, args: unknown[]): TimeGrain | null => {
  const startOf = START_OF.exec(name)?.[1];
  if (startOf) {
    return grainOfUnit(startOf);
  }
  switch (name) {
    case "date_trunc":
    case "date_part":
    case "datepart": {
      return grainOfUnit(textOf(args[0]));
    }
    case "strftime": {
      return grainOfFormat(textOf(args[0]));
    }
    case "date_format": {
      return grainOfFormat(textOf(args[1]));
    }
    default: {
      return null;
    }
  }
};

const bucketOf = (expression: unknown): Bucket | null => {
  const fn = nodeOf(unwrap(expression), "function");
  if (!(fn && typeof fn.name === "string")) {
    return null;
  }
  const args = listOf(fn.args);
  const grain = bucketGrain(fn.name.toLowerCase(), args);
  const column = args.map(columnOf).find((item) => item !== null);
  return grain && column ? { column, grain } : null;
};

const COMPARISONS = new Set(["gt", "gte", "lt", "lte", "eq", "neq"]);
const RANGES = new Set(["gt", "gte", "lt", "lte", "between"]);
const NOW_FUNCTIONS = new Set([
  "current_date",
  "current_timestamp",
  "now",
  "today",
  "getdate",
  "sysdate",
  "date",
  "datetime",
]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

const isDateLike = (value: unknown): boolean => {
  const literal = nodeOf(value, "literal");
  if (literal) {
    const type = literal.literal_type;
    return (
      type === "date" ||
      type === "timestamp" ||
      (typeof literal.value === "string" && ISO_DATE.test(literal.value))
    );
  }
  if (nodeOf(value, "interval")) {
    return true;
  }
  const fn = nodeOf(value, "function");
  if (fn) {
    return (
      typeof fn.name === "string" && NOW_FUNCTIONS.has(fn.name.toLowerCase())
    );
  }
  const arithmetic = nodeOf(value, "sub") ?? nodeOf(value, "add");
  if (arithmetic) {
    return isDateLike(arithmetic.left) || isDateLike(arithmetic.right);
  }
  const cast = nodeOf(value, "cast");
  return cast ? isDateLike(cast.this) : false;
};

const operatorOf = (conjunct: unknown): [string, Node] | null => {
  if (!isRecord(conjunct)) {
    return null;
  }
  const [entry] = Object.entries(conjunct);
  return entry && isRecord(entry[1]) ? [entry[0], entry[1]] : null;
};

const timeComparison = (conjunct: unknown): ColumnRef | null => {
  const operator = operatorOf(conjunct);
  if (!operator) {
    return null;
  }
  const [kind, node] = operator;
  if (kind === "between") {
    const column = columnOf(node.this);
    return column && (isDateLike(node.low) || isDateLike(node.high))
      ? column
      : null;
  }
  if (!COMPARISONS.has(kind)) {
    return null;
  }
  const left = columnOf(node.left);
  if (left && isDateLike(node.right)) {
    return left;
  }
  const right = columnOf(node.right);
  return right && isDateLike(node.left) ? right : null;
};

const isJoinPredicate = (conjunct: unknown): boolean => {
  const eq = nodeOf(conjunct, "eq");
  return Boolean(eq && columnOf(eq.left) && columnOf(eq.right));
};

const conjunctsOf = (value: unknown): unknown[] => {
  const and = nodeOf(value, "and");
  return and ? [...conjunctsOf(and.left), ...conjunctsOf(and.right)] : [value];
};

const whereOf = (select: Node): unknown[] => {
  const where = nodeOf(select, "where_clause");
  return where ? conjunctsOf(where.this) : [];
};

const tableNodes = (select: Node): Node[] => {
  const from = nodeOf(select, "from");
  const sources = [
    ...listOf(from?.expressions),
    ...listOf(select.joins).map((join) => (isRecord(join) ? join.this : null)),
  ];
  return sources.flatMap((source) => {
    const table = nodeOf(source, "table");
    return table ? [table] : [];
  });
};

const cteBodies = (select: Node): Map<string, Node> => {
  const bodies = new Map<string, Node>();
  for (const cte of listOf(nodeOf(select, "with")?.ctes)) {
    const name = isRecord(cte) ? identifier(cte.alias) : null;
    const body = isRecord(cte) ? nodeOf(cte.this, "select") : null;
    if (name && body) {
      bodies.set(name.toLowerCase(), body);
    }
  }
  return bodies;
};

const realTablesOf = (select: Node, ctes: Map<string, Node>) => {
  const tables = new Map<string, string>();
  for (const table of tableNodes(select)) {
    const name = identifier(table.name);
    if (!name || ctes.has(name.toLowerCase())) {
      continue;
    }
    tables.set(name.toLowerCase(), name);
    const alias = identifier(table.alias);
    if (alias) {
      tables.set(alias.toLowerCase(), name);
    }
  }
  return tables;
};

const columnLabel = (column: ColumnRef, scope: SelectScope): string => {
  const table = column.table
    ? scope.realTables.get(column.table.toLowerCase())
    : undefined;
  return table ? `${table}.${column.name}` : column.name;
};

const clip = (text: string): string => {
  const flat = text.replaceAll(/\s+/g, " ").trim();
  return flat.length > FILTER_CHARS
    ? `${flat.slice(0, FILTER_CHARS - 1).trimEnd()}…`
    : flat;
};

const tableItems = (names: readonly string[]): SqlAssumption[] => {
  const unique = [
    ...new Set(names.map((name) => name.split(".").at(-1) ?? name)),
  ];
  return unique.slice(0, MAX_TABLES).map((name) => ({ kind: "table", name }));
};

const timeItem = (
  scope: SelectScope
): { item: SqlAssumption; fallback: unknown } | null => {
  for (const expression of listOf(scope.select.expressions)) {
    const bucket = bucketOf(expression);
    if (bucket) {
      return {
        fallback: null,
        item: {
          column: columnLabel(bucket.column, scope),
          grain: bucket.grain,
          kind: "time",
        },
      };
    }
  }
  for (const conjunct of whereOf(scope.select)) {
    const column = timeComparison(conjunct);
    if (column) {
      return {
        fallback: conjunct,
        item: { column: columnLabel(column, scope), grain: null, kind: "time" },
      };
    }
  }
  return null;
};

const isRange = (conjunct: unknown): boolean =>
  RANGES.has(operatorOf(conjunct)?.[0] ?? "");

const renderFilter = (
  conjunct: unknown,
  dialect: ReturnType<typeof toPolyglotDialect>
): SqlAssumption | null => {
  const generated = generate([conjunct], dialect);
  const text = generated.success ? generated.sql?.[0] : undefined;
  if (!text) {
    return null;
  }
  return {
    column: firstColumn(conjunct)?.name ?? null,
    kind: "filter",
    text: clip(text),
  };
};

const readCte = (select: Node, ctes: Map<string, Node>): Node | null => {
  const read = tableNodes(select)
    .map((table) => identifier(table.name)?.toLowerCase())
    .filter((name): name is string => name !== undefined && ctes.has(name));
  const [only] = read;
  return read.length === 1 && only ? (ctes.get(only) ?? null) : null;
};

const filterItems = (
  scope: SelectScope,
  ctes: Map<string, Node>,
  skip: unknown,
  dialect: ReturnType<typeof toPolyglotDialect>
): SqlAssumption[] => {
  const cte = readCte(scope.select, ctes);
  const conjuncts = [
    ...whereOf(scope.select),
    ...(cte ? whereOf(cte) : []),
  ].filter(
    (conjunct) =>
      !isJoinPredicate(conjunct) && !(conjunct === skip && isRange(conjunct))
  );
  return conjuncts
    .map((conjunct) => renderFilter(conjunct, dialect))
    .filter((item): item is SqlAssumption => item !== null)
    .slice(0, MAX_FILTERS);
};

const rowsOf = (value: unknown): number | null => {
  const holder = isRecord(value) ? value.this : null;
  const literal = nodeOf(holder, "literal");
  if (!(literal && literal.literal_type === "number")) {
    return null;
  }
  const rows = Number(literal.value);
  return Number.isSafeInteger(rows) && rows >= 0 ? rows : null;
};

const limitItem = (select: Node): SqlAssumption | null => {
  const rows = rowsOf(select.limit) ?? rowsOf(select.top);
  return rows === null ? null : { kind: "limit", rows };
};

const describeSelect = (
  statement: unknown,
  tables: readonly string[],
  dialect: ReturnType<typeof toPolyglotDialect>
): SqlAssumptions | null => {
  const select = nodeOf(statement, "select");
  if (!select) {
    return null;
  }
  const ctes = cteBodies(select);
  const scope: SelectScope = { realTables: realTablesOf(select, ctes), select };
  const time = timeItem(scope);
  const limit = limitItem(select);
  const items: SqlAssumption[] = [
    ...tableItems(tables),
    ...(time ? [time.item] : []),
    ...filterItems(scope, ctes, time?.fallback ?? null, dialect),
    ...(limit ? [limit] : []),
  ];
  return { items: items.slice(0, MAX_ITEMS) };
};

export const describeSqlAssumptions = (
  sql: string,
  dialectType: DialectType
): SqlAssumptions | null => {
  try {
    const dialect = toPolyglotDialect(dialectType);
    const parsed = parse(sql, dialect);
    const statements: unknown = parsed.ast;
    if (!(parsed.success && Array.isArray(statements))) {
      return null;
    }
    if (statements.length !== 1) {
      return null;
    }
    const tables = ast.getTableNames(parsed.ast[0]);
    return describeSelect(statements[0], tables, dialect);
  } catch {
    return null;
  }
};
