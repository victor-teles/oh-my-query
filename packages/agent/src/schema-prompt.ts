import type {
  ColumnDetail,
  DialectType,
  ForeignKeyItem,
  SchemaInfo,
  TableItem,
} from "@conch/core";

import { redactPii } from "@conch/core/client";

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
