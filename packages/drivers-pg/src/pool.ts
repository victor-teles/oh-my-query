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
    try {
      const [relations, columns, indexes, foreignKeys] = await Promise.all([
        fetchRelations(this.#pool, schemaName),
        fetchAllColumns(this.#pool, schemaName),
        fetchAllIndexes(this.#pool, schemaName),
        fetchAllForeignKeys(this.#pool, schemaName),
      ]);
      const { tables, views } = buildSchemaItem(
        relations,
        columns,
        indexes,
        foreignKeys
      );
      return { schemas: [{ name: schemaName, tables, views }] };
    } catch (error) {
      throw mapPgError(error);
    }
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

interface RelationRow {
  name: string;
  kind: "r" | "p" | "v";
  row_estimate: string | null;
}

interface ColumnRow {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  is_pk: boolean;
}

interface IndexRow {
  table_name: string;
  index_name: string;
  is_unique: boolean;
  columns: (string | null)[] | null;
}

interface ForeignKeyRow {
  table_name: string;
  constraint_name: string;
  column_name: string;
  referenced_table: string;
  referenced_column: string;
}

interface TableLike {
  name: string;
  columns: ColumnDetail[];
  indexes: IndexItem[];
  foreignKeys: ForeignKeyItem[];
  rowEstimate: number | null;
}

interface ViewLike {
  name: string;
  columns: ColumnDetail[];
}

async function fetchRelations(
  pool: PgPoolType,
  schema: string
): Promise<RelationRow[]> {
  const r = await pool.query<RelationRow>(
    `SELECT c.relname AS name,
            c.relkind AS kind,
            CASE WHEN c.relkind IN ('r', 'p') THEN c.reltuples::bigint ELSE NULL END AS row_estimate
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = $1
       AND c.relkind IN ('r', 'p', 'v')
     ORDER BY c.relname`,
    [schema]
  );
  return r.rows;
}

async function fetchAllColumns(
  pool: PgPoolType,
  schema: string
): Promise<ColumnRow[]> {
  const r = await pool.query<ColumnRow>(
    `SELECT c.table_name,
            c.column_name,
            c.data_type,
            c.is_nullable,
            c.column_default,
            (pk.column_name IS NOT NULL) AS is_pk
     FROM information_schema.columns c
     LEFT JOIN (
       SELECT kcu.table_name, kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema   = kcu.table_schema
        AND tc.table_name     = kcu.table_name
       WHERE tc.constraint_type = 'PRIMARY KEY'
         AND tc.table_schema    = $1
     ) pk ON pk.table_name = c.table_name AND pk.column_name = c.column_name
     WHERE c.table_schema = $1
     ORDER BY c.table_name, c.ordinal_position`,
    [schema]
  );
  return r.rows;
}

async function fetchAllIndexes(
  pool: PgPoolType,
  schema: string
): Promise<IndexRow[]> {
  const r = await pool.query<IndexRow>(
    `SELECT t.relname AS table_name,
            i.relname AS index_name,
            ix.indisunique AS is_unique,
            array_agg(COALESCE(a.attname, '(expression)') ORDER BY k.ord) AS columns
     FROM pg_index ix
     JOIN pg_class t ON t.oid = ix.indrelid
     JOIN pg_class i ON i.oid = ix.indexrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     JOIN LATERAL generate_subscripts(ix.indkey, 1) AS k(ord) ON TRUE
     LEFT JOIN pg_attribute a
       ON a.attrelid = t.oid
      AND a.attnum   = ix.indkey[k.ord]
      AND ix.indkey[k.ord] <> 0
     WHERE n.nspname = $1 AND t.relkind IN ('r', 'p')
     GROUP BY t.relname, i.relname, ix.indisunique
     ORDER BY t.relname, i.relname`,
    [schema]
  );
  return r.rows;
}

async function fetchAllForeignKeys(
  pool: PgPoolType,
  schema: string
): Promise<ForeignKeyRow[]> {
  const r = await pool.query<ForeignKeyRow>(
    `SELECT tc.table_name,
            tc.constraint_name,
            kcu.column_name,
            ccu.table_name  AS referenced_table,
            ccu.column_name AS referenced_column
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema   = kcu.table_schema
      AND tc.table_name     = kcu.table_name
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema   = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema    = $1
     ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position`,
    [schema]
  );
  return r.rows;
}

function parseRowEstimate(raw: string | null): number | null {
  if (raw === null) {
    return null;
  }
  const est = Number.parseInt(String(raw), 10);
  return Number.isFinite(est) && est >= 0 ? est : null;
}

function buildSchemaItem(
  relations: RelationRow[],
  columns: ColumnRow[],
  indexes: IndexRow[],
  foreignKeys: ForeignKeyRow[]
): { tables: TableLike[]; views: ViewLike[] } {
  const tables = new Map<string, TableLike>();
  const views = new Map<string, ViewLike>();

  for (const r of relations) {
    if (r.kind === "v") {
      views.set(r.name, { columns: [], name: r.name });
    } else {
      tables.set(r.name, {
        columns: [],
        foreignKeys: [],
        indexes: [],
        name: r.name,
        rowEstimate: parseRowEstimate(r.row_estimate),
      });
    }
  }

  for (const c of columns) {
    const target = tables.get(c.table_name) ?? views.get(c.table_name);
    if (!target) {
      continue;
    }
    target.columns.push({
      dataType: c.data_type,
      defaultValue: c.column_default,
      isNullable: c.is_nullable === "YES",
      isPrimaryKey: Boolean(c.is_pk),
      name: c.column_name,
    });
  }

  for (const i of indexes) {
    const table = tables.get(i.table_name);
    if (!table) {
      continue;
    }
    table.indexes.push({
      columns: Array.isArray(i.columns)
        ? i.columns.filter((col): col is string => typeof col === "string")
        : [],
      isUnique: Boolean(i.is_unique),
      name: i.index_name,
    });
  }

  const fkByTable = new Map<string, Map<string, ForeignKeyItem>>();
  for (const f of foreignKeys) {
    if (!tables.has(f.table_name)) {
      continue;
    }
    let perTable = fkByTable.get(f.table_name);
    if (!perTable) {
      perTable = new Map<string, ForeignKeyItem>();
      fkByTable.set(f.table_name, perTable);
    }
    let entry = perTable.get(f.constraint_name);
    if (!entry) {
      entry = {
        columns: [],
        name: f.constraint_name,
        referencedColumns: [],
        referencedTable: f.referenced_table,
      };
      perTable.set(f.constraint_name, entry);
    }
    if (!entry.columns.includes(f.column_name)) {
      entry.columns.push(f.column_name);
    }
    if (!entry.referencedColumns.includes(f.referenced_column)) {
      entry.referencedColumns.push(f.referenced_column);
    }
  }
  for (const [tableName, perTable] of fkByTable) {
    const table = tables.get(tableName);
    if (table) {
      table.foreignKeys = [...perTable.values()];
    }
  }

  return {
    tables: [...tables.values()],
    views: [...views.values()],
  };
}

export { NOOP };
