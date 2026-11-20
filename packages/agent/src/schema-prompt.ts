import type {
  ColumnDetail,
  DialectType,
  ForeignKeyItem,
  SchemaInfo,
  TableItem,
} from "@oh-my-query/core";

import { redactPii } from "@oh-my-query/core/client";

export interface RedactOptions {
  enabled: boolean;
  customPatterns: string[];
}

export const DIALECT_LABELS: Record<DialectType, string> = {
  bigquery: "BigQuery",
  clickhouse: "ClickHouse",
  duckdb: "DuckDB",
  mysql: "MySQL",
  oracle: "Oracle",
  postgresql: "PostgreSQL",
  redshift: "Redshift",
  snowflake: "Snowflake",
  sqlite: "SQLite",
  tsql: "SQL Server",
};

const DEFAULT_SCHEMAS = new Set(["public", "main", "dbo"]);

const formatColumn = (column: ColumnDetail, fkTarget?: string): string => {
  const parts = [column.dataType];
  if (column.isPrimaryKey) {
    parts.push("PK");
  }
  parts.push(column.isNullable ? "NULLABLE" : "NOT NULL");
  const suffix = fkTarget ? ` → ${fkTarget}` : "";
  return `  ${column.name} (${parts.join(", ")})${suffix}`;
};

const buildFkMap = (foreignKeys: ForeignKeyItem[]): Map<string, string> => {
  const map = new Map<string, string>();
  for (const fk of foreignKeys) {
    const columns = Array.isArray(fk.columns) ? fk.columns : [];
    const referenced = Array.isArray(fk.referencedColumns)
      ? fk.referencedColumns
      : [];
    for (const [index, column] of columns.entries()) {
      const target = referenced[index];
      if (target) {
        map.set(column, `${fk.referencedTable}.${target}`);
      }
    }
  }
  return map;
};

const qualified = (schemaName: string, name: string): string =>
  DEFAULT_SCHEMAS.has(schemaName) ? name : `${schemaName}.${name}`;

const renderTable = (
  lines: string[],
  schemaName: string,
  table: TableItem
): void => {
  const columns = Array.isArray(table.columns) ? table.columns : [];
  const indexes = Array.isArray(table.indexes) ? table.indexes : [];
  const foreignKeys = Array.isArray(table.foreignKeys) ? table.foreignKeys : [];
  const fkMap = buildFkMap(foreignKeys);

  lines.push(`Table: ${qualified(schemaName, table.name)}`);
  for (const column of columns) {
    lines.push(formatColumn(column, fkMap.get(column.name)));
  }
  for (const index of indexes) {
    const indexColumns = Array.isArray(index.columns) ? index.columns : [];
    if (indexColumns.length === 0) {
      continue;
    }
    const onlyPrimaryKey = indexColumns.every((name) =>
      columns.some((column) => column.name === name && column.isPrimaryKey)
    );
    if (onlyPrimaryKey) {
      continue;
    }
    const unique = index.isUnique ? ", unique" : "";
    lines.push(`  Index: ${index.name} (${indexColumns.join(", ")}${unique})`);
  }
  lines.push("");
};

export interface SchemaPromptOptions {
  redact?: RedactOptions;
  omittedTables?: number;
}

const finish = (lines: string[], options: SchemaPromptOptions): string => {
  const omitted = options.omittedTables ?? 0;
  if (omitted > 0) {
    lines.push(
      `(${omitted} more tables were omitted as unrelated to the question.)`
    );
  }

  const text = lines.join("\n").trim();
  if (!options.redact?.enabled) {
    return text;
  }
  return redactPii(text, { customPatterns: options.redact.customPatterns })
    .text;
};

export const formatSchemaForPrompt = (
  schema: SchemaInfo,
  dialect: DialectType,
  options: SchemaPromptOptions = {}
): string => {
  const lines = [`Database type: ${DIALECT_LABELS[dialect]}`, ""];

  for (const item of schema.schemas) {
    for (const table of item.tables) {
      renderTable(lines, item.name, table);
    }
    for (const view of item.views) {
      const columns = view.columns.map((column) => column.name).join(", ");
      lines.push(`View: ${qualified(item.name, view.name)} (${columns})`);
    }
    if (item.views.length > 0) {
      lines.push("");
    }
  }

  return finish(lines, options);
};

const counts = new Intl.NumberFormat("en-US");

const estimate = (rows: number | null, unit: string): string | null =>
  rows === null
    ? null
    : `≈${counts.format(rows)} ${unit}${rows === 1 ? "" : "s"}`;

const describedAs = (name: string, facts: (string | null)[]): string => {
  const known = facts.filter((fact): fact is string => fact !== null);
  return known.length > 0 ? `${name} (${known.join(", ")})` : name;
};

const mongoCollectionLine = (table: TableItem): string => {
  const head = describedAs(table.name, [estimate(table.rowEstimate, "doc")]);
  const fields = table.columns.map(
    (column) => `${column.name} ${column.dataType}`
  );
  return fields.length > 0 ? `${head}: ${fields.join(", ")}` : head;
};

export const formatMongoSchema = (
  schema: SchemaInfo,
  options: SchemaPromptOptions = {}
): string => {
  const lines = ["Database type: MongoDB", ""];
  for (const item of schema.schemas) {
    for (const table of item.tables) {
      lines.push(mongoCollectionLine(table));
    }
    for (const view of item.views) {
      lines.push(`${view.name} (view)`);
    }
  }
  return finish(lines, options);
};

const isRedisValue = (columns: readonly ColumnDetail[]): boolean =>
  columns.length === 1 && columns[0]?.name === "value";

const redisPatternLine = (table: TableItem): string => {
  const { columns } = table;
  const type = isRedisValue(columns) ? columns[0]?.dataType : "hash";
  const head = describedAs(table.name, [
    type ?? null,
    estimate(table.rowEstimate, "key"),
  ]);
  if (isRedisValue(columns) || columns.length === 0) {
    return head;
  }
  return `${head}: ${columns.map((column) => column.name).join(", ")}`;
};

export const formatRedisSchema = (
  schema: SchemaInfo,
  options: SchemaPromptOptions = {}
): string => {
  const lines = ["Database type: Redis", ""];
  for (const item of schema.schemas) {
    for (const table of item.tables) {
      lines.push(redisPatternLine(table));
    }
  }
  if (lines.length === 2) {
    lines.push("(No keys were found.)");
  }
  return finish(lines, options);
};
