import type { LookupKind, LookupValue } from "./lookup-value.ts";
import type { TemplateValue } from "./sql-template.ts";
import type {
  ColumnDetail,
  DialectType,
  SchemaInfo,
  TableItem,
} from "./types.ts";

import {
  limitedSelect,
  qualifiedTable,
  quoteIdentifier,
} from "./sql-identifiers.ts";

export interface LookupLimits {
  maxProbes: number;
  maxTables: number;
  largeTableRows: number;
  countCap: number;
}

export const DEFAULT_LOOKUP_LIMITS: LookupLimits = {
  countCap: 100,
  largeTableRows: 1_000_000,
  maxProbes: 40,
  maxTables: 25,
};

export type ProbeStrength = "key" | "indexed" | "scan";

export interface LookupProbe {
  rank: number;
  schema: string;
  table: string;
  column: string;
  template: string;
  strength: ProbeStrength;
}

export interface LookupSkips {
  largeUnindexed: number;
  overLimit: number;
  outOfRange: number;
}

export interface LookupPlan {
  probes: LookupProbe[];
  skipped: LookupSkips;
  tables: number;
}

export type ColumnKind = "uuid" | "text" | "integer" | "other";

const WRAPPED = /^(?:lowcardinality|nullable)\((.*)\)$/;
const SIZE_SUFFIX = /\s*\([^)]*\)/g;
const SIGN_SUFFIX = /\s+(?:unsigned|signed|zerofill)\b/g;

const UUID_TYPES = new Set(["uuid", "uniqueidentifier"]);
const TEXT_TYPES = new Set([
  "char",
  "character",
  "varchar",
  "character varying",
  "text",
  "citext",
  "nchar",
  "nvarchar",
  "string",
]);
const INTEGER_TYPES = new Set([
  "smallint",
  "int2",
  "integer",
  "int",
  "int4",
  "bigint",
  "int8",
  "mediumint",
  "serial",
  "bigserial",
  "hugeint",
  "ubigint",
  "uinteger",
]);
const UUID_DIALECTS: ReadonlySet<DialectType> = new Set([
  "postgresql",
  "duckdb",
  "tsql",
]);

const INT64_MAX = 9_223_372_036_854_775_807n;
const INTEGER_MAX: Readonly<Record<string, bigint>> = {
  int: 2_147_483_647n,
  int2: 32_767n,
  int4: 2_147_483_647n,
  integer: 2_147_483_647n,
  mediumint: 8_388_607n,
  serial: 2_147_483_647n,
  smallint: 32_767n,
  uinteger: 4_294_967_295n,
};

const baseType = (dataType: string): string => {
  let type = dataType.trim().toLowerCase();
  let wrapped = WRAPPED.exec(type);
  while (wrapped?.[1]) {
    type = wrapped[1].trim();
    wrapped = WRAPPED.exec(type);
  }
  return type.replaceAll(SIZE_SUFFIX, "").replaceAll(SIGN_SUFFIX, "").trim();
};

const sqliteKind = (type: string): ColumnKind => {
  if (type.includes("int")) {
    return "integer";
  }
  if (type.includes("char") || type.includes("clob") || type.includes("text")) {
    return "text";
  }
  return "other";
};

export const columnKind = (
  dataType: string,
  dialect: DialectType
): ColumnKind => {
  const type = baseType(dataType);
  if (dialect === "sqlite") {
    return sqliteKind(type);
  }
  if (UUID_TYPES.has(type) && UUID_DIALECTS.has(dialect)) {
    return "uuid";
  }
  if (TEXT_TYPES.has(type)) {
    return "text";
  }
  return INTEGER_TYPES.has(type) ? "integer" : "other";
};

const integerMax = (dataType: string, dialect: DialectType): bigint =>
  dialect === "sqlite"
    ? INT64_MAX
    : (INTEGER_MAX[baseType(dataType)] ?? INT64_MAX);

const ID_NAME = /^(?:id|ID|Id)$|_(?:id|ID)$|[a-z0-9](?:Id|ID)$/;
const UUID_NAME =
  /^(?:uuid|guid)$|_(?:uuid|guid)$|[a-z0-9](?:Uuid|UUID|Guid|GUID)$/i;
const EMAIL_NAME = /email|^mail$|_mail$/i;
const EXACT_NAMES = new Set(["id", "uuid", "guid", "email", "mail"]);

const namesId = (name: string): boolean => ID_NAME.test(name);

type Fit = "skip" | "outOfRange" | "match";

const fitOf = (
  column: ColumnDetail,
  value: LookupValue,
  dialect: DialectType
): Fit => {
  const kind = columnKind(column.dataType, dialect);
  switch (value.kind) {
    case "uuid": {
      const named = namesId(column.name) || UUID_NAME.test(column.name);
      return kind === "uuid" || (kind === "text" && named) ? "match" : "skip";
    }
    case "email": {
      return kind === "text" && EMAIL_NAME.test(column.name) ? "match" : "skip";
    }
    default: {
      if (
        !(kind === "integer" && (namesId(column.name) || column.isPrimaryKey))
      ) {
        return "skip";
      }
      return BigInt(value.value) <= integerMax(column.dataType, dialect)
        ? "match"
        : "outOfRange";
    }
  }
};

const strengthOf = (table: TableItem, column: string): ProbeStrength => {
  const leads = table.indexes.filter((index) => index.columns[0] === column);
  const primary = table.columns.find((item) => item.name === column);
  if (primary?.isPrimaryKey || leads.some((index) => index.isUnique)) {
    return "key";
  }
  const foreign = table.foreignKeys.some((key) => key.columns.includes(column));
  return leads.length > 0 || foreign ? "indexed" : "scan";
};

interface Candidate {
  schema: string;
  table: TableItem;
  column: string;
  strength: ProbeStrength;
}

const STRENGTH_ORDER: Record<ProbeStrength, number> = {
  indexed: 1,
  key: 0,
  scan: 2,
};

const nameFit = (column: string): number =>
  EXACT_NAMES.has(column.toLowerCase()) ? 0 : 1;

const rowOrder = (rows: number | null): number =>
  rows === null ? Number.POSITIVE_INFINITY : rows;

const compareCandidates = (a: Candidate, b: Candidate): number =>
  STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength] ||
  nameFit(a.column) - nameFit(b.column) ||
  rowOrder(a.table.rowEstimate) - rowOrder(b.table.rowEstimate) ||
  a.table.name.localeCompare(b.table.name) ||
  a.column.localeCompare(b.column) ||
  a.schema.localeCompare(b.schema);

const usableName = (name: string): boolean =>
  name !== "" && !name.includes("\0") && !name.includes("{{");

const emptySkips = (): LookupSkips => ({
  largeUnindexed: 0,
  outOfRange: 0,
  overLimit: 0,
});

const collectCandidates = (
  schema: SchemaInfo,
  value: LookupValue,
  dialect: DialectType,
  limits: LookupLimits,
  skipped: LookupSkips
): Candidate[] => {
  const candidates: Candidate[] = [];
  for (const item of schema.schemas) {
    for (const table of item.tables) {
      if (!(usableName(item.name) && usableName(table.name))) {
        continue;
      }
      for (const column of table.columns) {
        if (!usableName(column.name)) {
          continue;
        }
        const fit = fitOf(column, value, dialect);
        if (fit === "outOfRange") {
          skipped.outOfRange += 1;
        }
        if (fit !== "match") {
          continue;
        }
        const strength = strengthOf(table, column.name);
        const large = (table.rowEstimate ?? 0) > limits.largeTableRows;
        if (strength === "scan" && large) {
          skipped.largeUnindexed += 1;
          continue;
        }
        candidates.push({
          column: column.name,
          schema: item.name,
          strength,
          table,
        });
      }
    }
  }
  return candidates.toSorted(compareCandidates);
};

const probeTemplate = (
  dialect: DialectType,
  candidate: Candidate,
  limits: LookupLimits
): string =>
  limitedSelect(
    dialect,
    qualifiedTable(dialect, candidate.schema, candidate.table.name),
    "1",
    limits.countCap + 1,
    `${quoteIdentifier(dialect, candidate.column)} = {{value}}`
  );

export const planLookupProbes = (
  schema: SchemaInfo,
  value: LookupValue,
  dialect: DialectType,
  limits: LookupLimits = DEFAULT_LOOKUP_LIMITS
): LookupPlan => {
  const skipped = emptySkips();
  const tables = new Set<string>();
  const probes: LookupProbe[] = [];
  for (const candidate of collectCandidates(
    schema,
    value,
    dialect,
    limits,
    skipped
  )) {
    const tableKey = `${candidate.schema}\0${candidate.table.name}`;
    const newTable = !tables.has(tableKey);
    if (
      probes.length >= limits.maxProbes ||
      (newTable && tables.size >= limits.maxTables)
    ) {
      skipped.overLimit += 1;
      continue;
    }
    tables.add(tableKey);
    probes.push({
      column: candidate.column,
      rank: probes.length,
      schema: candidate.schema,
      strength: candidate.strength,
      table: candidate.table.name,
      template: probeTemplate(dialect, candidate, limits),
    });
  }
  return { probes, skipped, tables: tables.size };
};

export const lookupTemplateValue = (value: LookupValue): TemplateValue => {
  if (value.kind !== "integer") {
    return { kind: "text", value: value.value };
  }
  const number = Number(value.value);
  return Number.isSafeInteger(number)
    ? { kind: "number", value: number }
    : { kind: "text", value: value.value };
};

export const lookupKindFits = (
  kind: LookupKind,
  dataType: string,
  dialect: DialectType
): boolean => {
  const column = columnKind(dataType, dialect);
  if (kind === "uuid") {
    return column === "uuid" || column === "text";
  }
  return kind === "email" ? column === "text" : column === "integer";
};
