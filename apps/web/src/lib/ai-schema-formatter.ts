import type { RedisKey, RedisKeyKind, SchemaInfo } from "@/lib/tauri";

import { promptComponents } from "@/lib/json-render";

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
    for (let i = 0; i < fk.columns.length; i += 1) {
      const col = fk.columns[i];
      const ref = fk.referencedColumns[i];
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
  const fkMap = buildFkMap(table.foreignKeys);
  const prefix = schemaName !== "public" ? `${schemaName}.` : "";
  lines.push(`Table: ${prefix}${table.name}`);
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
};

export const formatSchemaForPrompt = (
  schema: SchemaInfo,
  dbType: string,
  redisKeys?: RedisKey[] | null
): string => {
  if (dbType === "redis") {
    const dbName = schema.schemas[0]?.name ?? "db0";
    return formatRedisKeysForPrompt(redisKeys ?? null, dbName);
  }

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

  return lines.join("\n").trim();
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
- You can combine both: generate SQL for the query AND a UI to display results

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

Available Components:

${formatComponentDocs()}`;

const UI_GENERATION_PROMPT = buildUiGenerationPrompt();

export const buildSystemPrompt = (
  schema: SchemaInfo,
  dbType: string,
  redisKeys?: RedisKey[] | null
): string => {
  const label = DB_TYPE_LABELS[dbType] ?? dbType;
  const formattedSchema = formatSchemaForPrompt(schema, dbType, redisKeys);

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
