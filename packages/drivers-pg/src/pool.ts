import type {
  ColumnDetail,
  ColumnInfo,
  DialectType,
  ExecuteResult,
  ExplainResult,
  ForeignKeyItem,
  IndexItem,
  Pool,
  SchemaInfo,
} from "@oh-my-query/core";
import type { FieldDef, Pool as PgPoolType, PoolClient } from "pg";

import {
  DbError,
  guardDestructive,
  parsePostgres,
  validateSchemaName,
} from "@oh-my-query/core";
import { types } from "pg";

const OID_TO_NAME = buildOidToName();

function buildOidToName(): Map<number, string> {
  const map = new Map<number, string>();
  for (const [name, oid] of Object.entries(types.builtins)) {
    if (typeof oid === "number") {
      map.set(oid, name);
    }
  }
  return map;
}

function typeNameForOid(oid: number): string {
  return OID_TO_NAME.get(oid) ?? `OID_${oid}`;
}

const NOOP = (): void => {
  // intentionally empty: swallows pool/transaction cleanup errors
};

export class PostgresPool implements Pool {
  readonly dialect: DialectType = "postgresql";
  readonly supportsExplain = true;
  readonly #pool: PgPoolType;

  constructor(pool: PgPoolType) {
    this.#pool = pool;
  }

  get raw(): PgPoolType {
    return this.#pool;
  }

  async fetchVersion(): Promise<string> {
    try {
      const r = await this.#pool.query<{ version: string }>("SELECT version()");
      const full = r.rows[0]?.version ?? "";
      return full.split(/\s+/).slice(0, 2).join(" ");
    } catch (error) {
      throw mapPgError(error);
    }
  }

  async listDatabases(): Promise<string[]> {
    try {
      const r = await this.#pool.query<{ schema_name: string }>(
        `SELECT schema_name FROM information_schema.schemata
         WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')
         ORDER BY schema_name`
      );
      return r.rows.map((row) => row.schema_name);
    } catch (error) {
      throw mapPgError(error);
    }
  }

  async fetchSchema(schemaName: string): Promise<SchemaInfo> {
    validateSchemaName(schemaName);
    const tables = await fetchTables(this.#pool, schemaName);
    const views = await fetchViews(this.#pool, schemaName);
    return { schemas: [{ name: schemaName, tables, views }] };
  }

  async execute(
    sql: string,
    maxRows: number,
    schema: string | null,
    signal: AbortSignal
  ): Promise<ExecuteResult> {
    const client = await this.#pool.connect();
    bindAbort(client, signal);
    try {
      if (schema) {
        validateSchemaName(schema);
        await client.query(`SET search_path TO "${schema}"`);
      }
      let rows: unknown[][];
      let columns: ColumnInfo[];
      let isTruncated = false;
      try {
        const result = await client.query({ rowMode: "array", text: sql });
        if (Array.isArray(result.rows) && result.rows.length > maxRows) {
          rows = result.rows.slice(0, maxRows) as unknown[][];
          isTruncated = true;
        } else {
          rows = (result.rows ?? []) as unknown[][];
        }
        columns = (result.fields ?? []).map(toColumnInfo);
      } finally {
        if (schema) {
          try {
            await client.query("RESET search_path");
          } catch {
            // best-effort
          }
        }
      }
      return {
        columns,
        executionTimeMs: 0,
        isTruncated,
        resultType: "tabular",
        rowCount: rows.length,
        rows: rows.map(jsonifyRow) as never,
      };
    } catch (error) {
      throw mapPgError(error);
    } finally {
      client.release();
    }
  }

  async explain(
    sql: string,
    analyze: boolean,
    schema: string | null,
    signal: AbortSignal
  ): Promise<ExplainResult> {
    const trimmed = sql.trim().replace(/;+$/, "").trim();
    if (!trimmed) {
      throw new DbError("EXPLAIN_EMPTY", "Cannot EXPLAIN empty SQL");
    }
    if (analyze) {
      guardDestructive(trimmed);
    }
    const opts = analyze
      ? "ANALYZE, BUFFERS, VERBOSE, FORMAT JSON"
      : "VERBOSE, FORMAT JSON";
    const wrapped = `EXPLAIN (${opts}) ${trimmed}`;

    const client = await this.#pool.connect();
    bindAbort(client, signal);
    const start = performance.now();
    try {
      await client.query("BEGIN");
      try {
        if (analyze) {
          await client.query("SET TRANSACTION READ ONLY");
        }
        if (schema) {
          validateSchemaName(schema);
          await client.query(`SET LOCAL search_path TO "${schema}"`);
        }
        const result = await client.query<{ "QUERY PLAN": unknown }>(wrapped);
        const raw = (result.rows[0] as { "QUERY PLAN": unknown } | undefined)?.[
          "QUERY PLAN"
        ];
        const root = parsePostgres((Array.isArray(raw) ? raw : [raw]) as never);
        return {
          analyzeRan: analyze,
          engine: "postgresql",
          executionTimeMs: Math.round(performance.now() - start),
          raw: JSON.stringify(raw, null, 2),
          root,
          supportsAnalyze: true,
        };
      } finally {
        try {
          await client.query("ROLLBACK");
        } catch {
          // best-effort
        }
      }
    } catch (error) {
      throw mapExplainError(error, analyze);
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    try {
      await this.#pool.end();
    } catch {
      // pool may already be ending
    }
  }
}

function toColumnInfo(field: FieldDef): ColumnInfo {
  return { name: field.name, typeName: typeNameForOid(field.dataTypeID) };
}

function jsonifyRow(row: unknown[]): unknown[] {
  return row.map(jsonifyValue);
}

function jsonifyValue(v: unknown): unknown {
  if (v === null) {
    return null;
  }
  if (v instanceof Date) {
    return v.toISOString();
  }
  if (Buffer.isBuffer(v)) {
    return `\\x${v.toString("hex")}`;
  }
  if (typeof v === "bigint") {
    return v.toString();
  }
  if (Array.isArray(v)) {
    return v.map(jsonifyValue);
  }
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(obj)) {
      out[k] = jsonifyValue(val);
    }
    return out;
  }
  return v;
}

function bindAbort(client: PoolClient, signal: AbortSignal): void {
  if (signal.aborted) {
    client.release(true);
    throw DbError.cancelled();
  }
  signal.addEventListener(
    "abort",
    () => {
      try {
        client.release(true);
      } catch {
        // already released
      }
    },
    { once: true }
  );
}

export function mapPgError(err: unknown): DbError {
  if (err instanceof DbError) {
    return err;
  }
  if (err instanceof AggregateError && err.errors.length > 0) {
    const [inner, ...rest] = err.errors;
    const mapped = mapPgError(inner);
    if (rest.length === 0) {
      return mapped;
    }
    const extras = rest
      .map((sub) => (sub instanceof Error ? sub.message : String(sub)))
      .filter((m) => m.length > 0);
    const combined =
      extras.length > 0
        ? `${mapped.message} (also: ${extras.join("; ")})`
        : mapped.message;
    return new DbError(mapped.code, combined);
  }
  const e = err as { code?: string; message?: string; name?: string };
  const code = e.code ?? "DB_ERROR";
  const stringified = String(err);
  const message =
    (typeof e.message === "string" && e.message.length > 0 && e.message) ||
    (stringified !== "[object Object]" && stringified) ||
    e.name ||
    code;
  return new DbError(code, message);
}

function mapExplainError(err: unknown, analyze: boolean): DbError {
  const e = err as { code?: string };
  if (analyze && e.code === "25006") {
    return new DbError(
      "EXPLAIN_DESTRUCTIVE",
      "Refusing to EXPLAIN ANALYZE a statement that would modify data. Turn off ANALYZE to see the estimated plan."
    );
  }
  return mapPgError(err);
}

async function fetchTables(pool: PgPoolType, schema: string) {
  const tableRows = await pool.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = $1 AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
    [schema]
  );
  const estimates = await fetchRowEstimates(pool, schema);
  const result = [];
  for (const row of tableRows.rows) {
    const tableName = row.table_name;
    const [columns, indexes, foreignKeys] = await Promise.all([
      fetchColumns(pool, schema, tableName),
      fetchIndexes(pool, schema, tableName),
      fetchForeignKeys(pool, schema, tableName),
    ]);
    result.push({
      columns,
      foreignKeys,
      indexes,
      name: tableName,
      rowEstimate: estimates.get(tableName) ?? null,
    });
  }
  return result;
}

async function fetchRowEstimates(
  pool: PgPoolType,
  schema: string
): Promise<Map<string, number>> {
  const r = await pool.query<{ table_name: string; row_estimate: string }>(
    `SELECT c.relname AS table_name, c.reltuples::bigint AS row_estimate
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = $1 AND c.relkind = 'r'`,
    [schema]
  );
  const out = new Map<string, number>();
  for (const row of r.rows) {
    const est = Number.parseInt(String(row.row_estimate), 10);
    if (Number.isFinite(est) && est >= 0) {
      out.set(row.table_name, est);
    }
  }
  return out;
}

async function fetchViews(pool: PgPoolType, schema: string) {
  const r = await pool.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = $1 AND table_type = 'VIEW'
     ORDER BY table_name`,
    [schema]
  );
  const views = [];
  for (const row of r.rows) {
    const columns = await fetchColumns(pool, schema, row.table_name);
    views.push({ columns, name: row.table_name });
  }
  return views;
}

async function fetchColumns(
  pool: PgPoolType,
  schema: string,
  table: string
): Promise<ColumnDetail[]> {
  const r = await pool.query<{
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
    is_pk: boolean;
  }>(
    `SELECT c.column_name, c.data_type, c.is_nullable, c.column_default,
            CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_pk
     FROM information_schema.columns c
     LEFT JOIN (
       SELECT kcu.column_name FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
       WHERE tc.constraint_type = 'PRIMARY KEY'
         AND tc.table_schema = $1 AND tc.table_name = $2
     ) pk ON c.column_name = pk.column_name
     WHERE c.table_schema = $1 AND c.table_name = $2
     ORDER BY c.ordinal_position`,
    [schema, table]
  );
  return r.rows.map((row) => ({
    dataType: row.data_type,
    defaultValue: row.column_default,
    isNullable: row.is_nullable === "YES",
    isPrimaryKey: Boolean(row.is_pk),
    name: row.column_name,
  }));
}

async function fetchIndexes(
  pool: PgPoolType,
  schema: string,
  table: string
): Promise<IndexItem[]> {
  const r = await pool.query<{
    index_name: string;
    is_unique: boolean;
    columns: string[];
  }>(
    `SELECT i.relname AS index_name,
            ix.indisunique AS is_unique,
            array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) AS columns
     FROM pg_index ix
     JOIN pg_class t ON t.oid = ix.indrelid
     JOIN pg_class i ON i.oid = ix.indexrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
     WHERE n.nspname = $1 AND t.relname = $2
     GROUP BY i.relname, ix.indisunique
     ORDER BY i.relname`,
    [schema, table]
  );
  return r.rows.map((row) => ({
    columns: row.columns ?? [],
    isUnique: Boolean(row.is_unique),
    name: row.index_name,
  }));
}

async function fetchForeignKeys(
  pool: PgPoolType,
  schema: string,
  table: string
): Promise<ForeignKeyItem[]> {
  const r = await pool.query<{
    constraint_name: string;
    column_name: string;
    referenced_table: string;
    referenced_column: string;
  }>(
    `SELECT tc.constraint_name,
            kcu.column_name,
            ccu.table_name AS referenced_table,
            ccu.column_name AS referenced_column
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema = $1 AND tc.table_name = $2
     ORDER BY tc.constraint_name, kcu.ordinal_position`,
    [schema, table]
  );
  const map = new Map<string, ForeignKeyItem>();
  for (const row of r.rows) {
    let entry = map.get(row.constraint_name);
    if (!entry) {
      entry = {
        columns: [],
        name: row.constraint_name,
        referencedColumns: [],
        referencedTable: row.referenced_table,
      };
      map.set(row.constraint_name, entry);
    }
    if (!entry.columns.includes(row.column_name)) {
      entry.columns.push(row.column_name);
    }
    if (!entry.referencedColumns.includes(row.referenced_column)) {
      entry.referencedColumns.push(row.referenced_column);
    }
  }
  return [...map.values()];
}

export { NOOP };
