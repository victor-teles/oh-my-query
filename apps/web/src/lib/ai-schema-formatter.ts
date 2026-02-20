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

const UI_GENERATION_PROMPT = `
You can also generate dynamic UIs when the user asks for visualizations, dashboards, summaries, or any visual representation of data. Use the json-render spec format wrapped in \`\`\`jsonrender code blocks.

When to generate UI vs SQL:
- Data queries, filtering, aggregation → SQL (\`\`\`sql)
- Dashboards, cards, visual summaries, data displays → UI (\`\`\`jsonrender)
- You can combine both: generate SQL for the query AND a UI to display results

JSON Render Spec Format:
\`\`\`
{
  "root": "<root-element-key>",
  "elements": {
    "<element-key>": {
      "type": "<ComponentType>",
      "props": { ... },
      "children": ["<child-key-1>", "<child-key-2>"]
    }
  }
}
\`\`\`

Rules:
- Every element key in "children" MUST exist in "elements"
- "root" MUST reference an existing element key
- Use descriptive element keys (e.g., "main-card", "stats-heading")

Available Components:

Card: { title?: string, description?: string }
  Container with optional title/description. Use as top-level wrapper.

Stack: { direction?: "horizontal" | "vertical", gap?: number, align?: "start" | "center" | "end", justify?: "start" | "center" | "end" | "between" }
  Flex layout container.

Grid: { columns?: number, gap?: number }
  Grid layout container.

Heading: { text: string, level?: 1 | 2 | 3 | 4 | 5 | 6 }
  Text heading.

Text: { text: string, variant?: "default" | "muted" | "destructive" }
  Paragraph text.

Badge: { text: string, variant?: "default" | "secondary" | "destructive" | "outline" }
  Small label/tag.

Avatar: { src?: string, name: string, size?: "sm" | "md" | "lg" }
  User avatar with initials fallback.

Image: { src?: string, alt: string, width?: number, height?: number }
  Image display.

Table: { columns: string[], rows: string[][], caption?: string }
  Data table.

Alert: { title: string, message?: string, type?: "default" | "destructive" }
  Alert/notice box.

Progress: { value: number, max?: number, label?: string }
  Progress bar.

Separator: { orientation?: "horizontal" | "vertical" }
  Visual divider.

Tabs: { tabs: { label: string, value: string }[], defaultValue?: string }
  Tabbed container. Children are rendered in tab panels.

Accordion: { items: { title: string, content: string }[] }
  Collapsible sections.

Collapsible: { title: string, defaultOpen?: boolean }
  Single collapsible section with children.`;

export const buildSystemPrompt = (
  schema: SchemaInfo,
  dbType: string
): string => {
  const label = DB_TYPE_LABELS[dbType] ?? dbType;
  const formattedSchema = formatSchemaForPrompt(schema, dbType);

  return `You are a database assistant for a ${label} database. You help users write queries, explain SQL, diagnose errors, suggest optimizations, and create visual UIs to display data.

When generating SQL:
- Use the correct ${label} dialect
- Reference only tables and columns from the schema below
- Wrap SQL in \`\`\`sql code blocks
- Be concise in explanations
${UI_GENERATION_PROMPT}

Database Schema:
${formattedSchema}`;
};
