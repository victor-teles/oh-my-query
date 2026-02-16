import type { SchemaInfo } from "@/lib/tauri";

const MAX_TABLES = 50;

const DB_TYPE_LABELS: Record<string, string> = {
  mongodb: "MongoDB",
  mysql: "MySQL",
  postgresql: "PostgreSQL",
  redis: "Redis",
  sqlite: "SQLite",
};

const formatColumn = (
  col: {
    name: string;
    dataType: string;
    isNullable: boolean;
    isPrimaryKey: boolean;
  },
  fkTarget?: string
): string => {
  const parts = [col.dataType];
  if (col.isPrimaryKey) {
    parts.push("PK");
  }
  if (col.isNullable) {
    parts.push("NULLABLE");
  } else {
    parts.push("NOT NULL");
  }
  const suffix = fkTarget ? ` → ${fkTarget}` : "";
  return `  ${col.name} (${parts.join(", ")})${suffix}`;
};

export const formatSchemaForPrompt = (
  schema: SchemaInfo,
  dbType: string
): string => {
  const label = DB_TYPE_LABELS[dbType] ?? dbType;
  const lines: string[] = [`Database type: ${label}`, ""];

  let tableCount = 0;
  let totalTables = 0;

  for (const s of schema.schemas) {
    totalTables += s.tables.length;

    for (const table of s.tables) {
      if (tableCount >= MAX_TABLES) {
        break;
      }
      tableCount += 1;

      const fkMap = new Map<string, string>();
      for (const fk of table.foreignKeys) {
        for (let i = 0; i < fk.columns.length; i += 1) {
          const col = fk.columns[i];
          const ref = fk.referencedColumns[i];
          if (col && ref) {
            fkMap.set(col, `${fk.referencedTable}.${ref}`);
          }
        }
      }

      lines.push(
        `Table: ${s.name !== "public" ? `${s.name}.` : ""}${table.name}`
      );
      for (const col of table.columns) {
        lines.push(formatColumn(col, fkMap.get(col.name)));
      }

      const nonPkIndexes = table.indexes.filter(
        (idx) =>
          !idx.columns.every((c) =>
            table.columns.some((col) => col.name === c && col.isPrimaryKey)
          )
      );
      for (const idx of nonPkIndexes) {
        const unique = idx.isUnique ? ", unique" : "";
        lines.push(`  Index: ${idx.name} (${idx.columns.join(", ")}${unique})`);
      }

      lines.push("");
    }

    for (const view of s.views) {
      const colNames = view.columns.map((c) => c.name).join(", ");
      lines.push(
        `View: ${s.name !== "public" ? `${s.name}.` : ""}${view.name} (${colNames})`
      );
    }

    if (s.views.length > 0) {
      lines.push("");
    }
  }

  if (totalTables > MAX_TABLES) {
    lines.push(`... and ${totalTables - MAX_TABLES} more tables`);
    lines.push("");
  }

  return lines.join("\n").trim();
};

export const buildSystemPrompt = (
  schema: SchemaInfo,
  dbType: string
): string => {
  const label = DB_TYPE_LABELS[dbType] ?? dbType;
  const formattedSchema = formatSchemaForPrompt(schema, dbType);

  return `You are a SQL assistant for a ${label} database. You help users write queries, explain SQL, diagnose errors, and suggest optimizations.

When generating SQL:
- Use the correct ${label} dialect
- Reference only tables and columns from the schema below
- Wrap SQL in \`\`\`sql code blocks
- Be concise in explanations

Database Schema:
${formattedSchema}`;
};
