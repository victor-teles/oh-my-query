import { redactPii } from "@oh-my-query/core";

import type { RedisKey, RedisKeyKind, SchemaInfo } from "@/lib/tauri";

import { promptComponents } from "@/lib/json-render";

export interface SchemaRedactOptions {
  enabled: boolean;
  customPatterns?: string[];
}

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

const REDIS_KIND_ORDER: RedisKeyKind[] = [
  "STRING",
  "HASH",
  "LIST",
  "SET",
  "ZSET",
  "STREAM",
  "UNKNOWN",
];

const formatTtlForPrompt = (ttlSecs: number | null): string => {
  if (ttlSecs === null) {
    return "no expiry";
  }
  if (ttlSecs < 60) {
    return `TTL ${ttlSecs}s`;
  }
  if (ttlSecs < 3600) {
    return `TTL ${Math.round(ttlSecs / 60)}m`;
  }
  if (ttlSecs < 86_400) {
    return `TTL ${Math.round(ttlSecs / 3600)}h`;
  }
  return `TTL ${Math.round(ttlSecs / 86_400)}d`;
};

const formatRedisSizeForPrompt = (key: RedisKey): string => {
  if (key.size === null) {
    return "";
  }
  if (key.sizeUnit === "") {
    return "";
  }
  if (key.sizeUnit === "bytes") {
    return `${key.size} bytes`;
  }
  return `${key.size} ${key.sizeUnit}`;
};

const formatRedisKeysForPrompt = (
  redisKeys: RedisKey[] | null,
  dbName: string
): string => {
  const lines: string[] = ["Database type: Redis", "", `Database: ${dbName}`];

  if (!redisKeys || redisKeys.length === 0) {
    lines.push("  (no keys sampled — the DB may be empty or gated)");
    return lines.join("\n").trim();
  }

  const byKind = new Map<RedisKeyKind, RedisKey[]>();
  for (const key of redisKeys) {
    const bucket = byKind.get(key.kind);
    if (bucket) {
      bucket.push(key);
    } else {
      byKind.set(key.kind, [key]);
    }
  }

  const sortedKinds = [...byKind.keys()].toSorted((a, b) => {
    const ai = REDIS_KIND_ORDER.indexOf(a);
    const bi = REDIS_KIND_ORDER.indexOf(b);
    return ai - bi;
  });

  for (const kind of sortedKinds) {
    const bucket = byKind.get(kind) ?? [];
    lines.push(
      `  ${kind} (${bucket.length} key${bucket.length === 1 ? "" : "s"}):`
    );
    const shown = bucket.slice(0, 20);
    for (const key of shown) {
      const meta = [
        formatTtlForPrompt(key.ttlSecs),
        formatRedisSizeForPrompt(key),
      ]
        .filter((s) => s.length > 0)
        .join(" · ");
      lines.push(meta ? `    ${key.name} — ${meta}` : `    ${key.name}`);
    }
    if (bucket.length > shown.length) {
      lines.push(`    … and ${bucket.length - shown.length} more`);
    }
  }

  return lines.join("\n").trim();
};

type TableShape = SchemaInfo["schemas"][number]["tables"][number];

const buildFkMap = (fks: TableShape["foreignKeys"]): Map<string, string> => {
  const map = new Map<string, string>();
  for (const fk of fks) {
    const cols = Array.isArray(fk.columns) ? fk.columns : [];
    const refs = Array.isArray(fk.referencedColumns)
      ? fk.referencedColumns
      : [];
    for (let i = 0; i < cols.length; i += 1) {
      const col = cols[i];
      const ref = refs[i];
      if (col && ref) {
        map.set(col, `${fk.referencedTable}.${ref}`);
      }
    }
  }
  return map;
};

const renderTableBlock = (
  lines: string[],
  schemaName: string,
  table: TableShape
) => {
  const tableColumns = Array.isArray(table.columns) ? table.columns : [];
  const tableIndexes = Array.isArray(table.indexes) ? table.indexes : [];
  const tableForeignKeys = Array.isArray(table.foreignKeys)
    ? table.foreignKeys
    : [];

  const fkMap = buildFkMap(tableForeignKeys);
  const prefix = schemaName !== "public" ? `${schemaName}.` : "";
  lines.push(`Table: ${prefix}${table.name}`);
  for (const col of tableColumns) {
    lines.push(formatColumn(col, fkMap.get(col.name)));
  }

  for (const idx of tableIndexes) {
    const indexCols = Array.isArray(idx.columns) ? idx.columns : [];
    if (indexCols.length === 0) {
      continue;
    }
    const isOnlyPk = indexCols.every((c) =>
      tableColumns.some((col) => col.name === c && col.isPrimaryKey)
    );
    if (isOnlyPk) {
      continue;
    }
    const unique = idx.isUnique ? ", unique" : "";
    lines.push(`  Index: ${idx.name} (${indexCols.join(", ")}${unique})`);
  }
  lines.push("");
};

export const formatSchemaForPrompt = (
  schema: SchemaInfo,
  dbType: string,
  redisKeys?: RedisKey[] | null,
  redact?: SchemaRedactOptions
): string => {
  let raw: string;

  if (dbType === "redis") {
    const dbName = schema.schemas[0]?.name ?? "db0";
    raw = formatRedisKeysForPrompt(redisKeys ?? null, dbName);
  } else {
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
        renderTableBlock(lines, s.name, table);
      }

      for (const view of s.views) {
        const colNames = view.columns.map((c) => c.name).join(", ");
        const prefix = s.name !== "public" ? `${s.name}.` : "";
        lines.push(`View: ${prefix}${view.name} (${colNames})`);
      }

      if (s.views.length > 0) {
        lines.push("");
      }
    }

    if (totalTables > MAX_TABLES) {
      lines.push(`... and ${totalTables - MAX_TABLES} more tables`);
      lines.push("");
    }

    raw = lines.join("\n").trim();
  }

  if (redact?.enabled) {
    return redactPii(raw, { customPatterns: redact.customPatterns }).text;
  }

  return raw;
};

const formatComponentDocs = (): string =>
  promptComponents
    .map((c) => `${c.name}: ${c.signature}\n  ${c.summary}`)
    .join("\n\n");

export const buildUiGenerationPrompt = (): string => `
You can also generate dynamic UIs when the user asks for visualizations, dashboards, summaries, or any visual representation of data. Wrap the spec in a \`jsonrender\` fenced code block.

When to generate UI vs SQL:
- Data queries, filtering, aggregation → SQL (\`\`\`sql)
- Dashboards, cards, visual summaries, data displays → UI (\`\`\`jsonrender)
- You can combine both in the same reply: emit a \`\`\`sql block for the query AND a \`\`\`jsonrender block that visualizes the result set

CRITICAL formatting rules — get these wrong and the UI won't render:
- The opening fence \`\`\`jsonrender MUST start on its own line, preceded by a blank line.
- The JSON spec MUST start on the line *after* the opening fence — never on the same line.
- The closing \`\`\` MUST be on its own line.
- Use the language tag \`jsonrender\` exactly — not \`json\`, not \`JsonRender\`.

Example (this exact shape, with the line breaks):

Here is your dashboard:

\`\`\`jsonrender
{
  "root": "main",
  "elements": {
    "main": {
      "type": "Card",
      "props": { "title": "Stats" },
      "children": ["body"]
    },
    "body": {
      "type": "Text",
      "props": { "text": "Hello" }
    }
  }
}
\`\`\`

Spec shape:
- "root": the key of the top-level element
- "elements": map of element key → { type, props, children? }
- Every key in "children" MUST exist in "elements"
- "root" MUST reference an existing element key
- Use descriptive element keys (e.g., "main-card", "stats-heading")
- Only use the components listed below — anything else will fail to render

Charts & result data:
- Pick ChartBar for category comparisons, ChartLine for trends over time/ordered axes, ChartPie for part-of-whole with few slices, and ChartKpi for a single headline number.
- Chart \`data\` is an array of row records, e.g. \`[{ "month": "Jan", "queries": 186 }]\`. \`xKey\` (and \`nameKey\`/\`valueKey\` for pie) must match real column names.
- When your reply includes SQL the user will run, bind the chart to the future result — use \`{ "$bindState": "/result/rows" }\` as the value of \`data\`. If your SQL is read-only (SELECT/WITH/SHOW/EXPLAIN/DESCRIBE), the chat auto-runs it on arrival and the chart populates without a click; otherwise the chart shows a "run the query above" placeholder until the user runs it.
- The renderer exposes the current result at these paths: \`/result/rows\` (keyed records), \`/result/columns\`, \`/result/rowCount\`, and a shortcut \`/rows\` alias. Either \`/result/rows\` or \`/rows\` works.
- Chart components already render inside their own titled frame with built-in \`title\` and \`description\` slots. Do NOT wrap a chart in a \`Card\` — that produces duplicated headings. If you need to group a chart with other elements, use \`Stack\` as the parent.
- When there's already an executed tabular result visible in the "Current workspace context" section and the user is asking to visualize exactly that result, still prefer the \`$bindState\` binding — it stays live if they re-run the query.
- Never invent numeric values. If you cannot produce a correct \`xKey\`/\`series\` from the schema or visible context, do not emit a chart; explain what you need instead.
- For large result sets, prefer a ChartKpi or aggregated bar/line chart over plotting every row. The renderer caps plots at 500 points and will downsample; call that out explicitly in your description when it matters.
- Combined-response pattern: respond with a short explanation, then the SQL in a \`\`\`sql block, then the visualization in a \`\`\`jsonrender block — in that order, each separated by a blank line.

Available Components:

${formatComponentDocs()}`;

const UI_GENERATION_PROMPT = buildUiGenerationPrompt();

export const buildSystemPrompt = (
  schema: SchemaInfo,
  dbType: string,
  redisKeys?: RedisKey[] | null,
  redact?: SchemaRedactOptions
): string => {
  const label = DB_TYPE_LABELS[dbType] ?? dbType;
  const formattedSchema = formatSchemaForPrompt(
    schema,
    dbType,
    redisKeys,
    redact
  );

  if (dbType === "redis") {
    return `You are a Redis assistant. You help users inspect Redis keyspaces, write Redis commands, diagnose errors, and create visual UIs to display data.

Redis uses commands, not SQL. When the user asks how to read or modify data, respond with a Redis command, not a SELECT statement.

When generating Redis commands:
- Use real Redis command syntax (GET, SET, HGETALL, HSET, HSCAN, LRANGE, ZRANGE WITHSCORES, XRANGE, SCAN MATCH, TYPE, TTL, etc.)
- Pick the command whose shape matches the value type — HGETALL for a HASH, LRANGE for a LIST, SMEMBERS for a SET, ZRANGE … WITHSCORES for a ZSET, XRANGE for a STREAM
- Prefer SCAN MATCH <pattern> over KEYS in production databases
- Reference only the keys listed in the keyspace below
- One command per code block; wrap in \`\`\`redis code blocks (or \`\`\`sh if redis is unsupported)
- When users paste a stringified JSON value, suggest inspecting it with GET + client-side parsing; don't invent JSON.GET/ReJSON unless the user has confirmed the module
- Be concise; mention destructive commands (FLUSHDB, DEL on critical keys) only when clearly asked, and warn before running

Keep explanations short — users are running these interactively.
${UI_GENERATION_PROMPT}

Redis Keyspace:
${formattedSchema}`;
  }

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
