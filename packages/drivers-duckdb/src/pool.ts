import type { DuckDBConnection, DuckDBInstance } from "@duckdb/node-api";
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

import {
  DbError,
  guardDestructive,
  parseDuckdb,
  validateSchemaName,
} from "@oh-my-query/core";
import { randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

type ReaderLike = Awaited<ReturnType<DuckDBConnection["runAndReadAll"]>>;

export class DuckdbPool implements Pool {
  readonly dialect: DialectType = "duckdb";
  readonly supportsExplain = true;
  #instance: DuckDBInstance | null;

  constructor(instance: DuckDBInstance) {
    this.#instance = instance;
  }

  get raw(): DuckDBInstance | null {
    return this.#instance;
  }

  async fetchVersion(): Promise<string> {
    const conn = await this.#connect();
    try {
      const r = await conn.runAndReadAll("SELECT version() AS version");
      const value = r.getRowsJson()[0]?.[0];
      return typeof value === "string" ? value : "";
    } catch (error) {
      throw mapDuckdbError(error);
    } finally {
      tryDisconnect(conn);
    }
  }

  async listDatabases(): Promise<string[]> {
    const conn = await this.#connect();
    try {
      const r = await conn.runAndReadAll(
        `SELECT DISTINCT schema_name
         FROM information_schema.schemata
         WHERE schema_name NOT IN ('information_schema', 'pg_catalog')
         ORDER BY schema_name`
      );
      return r
        .getRowsJson()
        .map((row) => row[0])
        .filter((value): value is string => typeof value === "string");
    } catch (error) {
      throw mapDuckdbError(error);
    } finally {
      tryDisconnect(conn);
    }
  }

  async fetchSchema(schemaName: string): Promise<SchemaInfo> {
    validateSchemaName(schemaName);
    const conn = await this.#connect();
    try {
      const [relations, columns, indexes, foreignKeys] = await Promise.all([
        fetchRelations(conn, schemaName),
        fetchAllColumns(conn, schemaName),
        fetchAllIndexes(conn, schemaName),
        fetchAllForeignKeys(conn, schemaName),
      ]);
      const { tables, views } = buildSchemaItem(
        relations,
        columns,
        indexes,
        foreignKeys
      );
      return { schemas: [{ name: schemaName, tables, views }] };
    } catch (error) {
      throw mapDuckdbError(error);
    } finally {
      tryDisconnect(conn);
    }
  }

  async execute(
    sql: string,
    maxRows: number,
    schema: string | null,
    signal: AbortSignal
  ): Promise<ExecuteResult> {
    const conn = await this.#connect();
    const release = bindAbort(conn, signal);
    try {
      if (schema) {
        validateSchemaName(schema);
        await conn.run(`SET search_path = '${schema}'`);
      }
      const reader = await conn.runAndReadAll(sql);
      const allRows = reader.getRowsJson() as unknown[][];
      const isTruncated = allRows.length > maxRows;
      const rows = isTruncated ? allRows.slice(0, maxRows) : allRows;
      const columns = readerColumns(reader);
      return {
        columns,
        executionTimeMs: 0,
        isTruncated,
        resultType: "tabular",
        rowCount: rows.length,
        rows,
      };
    } catch (error) {
      if (signal.aborted && signal.reason instanceof DbError) {
        throw signal.reason;
      }
      throw mapDuckdbError(error);
    } finally {
      release();
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

    const conn = await this.#connect();
    const release = bindAbort(conn, signal);
    const start = performance.now();
    try {
      if (schema) {
        validateSchemaName(schema);
        await conn.run(`SET search_path = '${schema}'`);
      }

      const { raw, json } = analyze
        ? await runAnalyzeJson(conn, trimmed)
        : await runExplainJson(conn, trimmed);

      const root = parseDuckdb(json as never);
      return {
        analyzeRan: analyze,
        engine: "duckdb",
        executionTimeMs: Math.round(performance.now() - start),
        raw,
        root,
        supportsAnalyze: true,
      };
    } catch (error) {
      if (signal.aborted && signal.reason instanceof DbError) {
        throw signal.reason;
      }
      if (error instanceof DbError) {
        throw error;
      }
      throw mapDuckdbError(error);
    } finally {
      release();
    }
  }

  close(): Promise<void> {
    this.#instance = null;
    return Promise.resolve();
  }

  #connect(): Promise<DuckDBConnection> {
    if (!this.#instance) {
      return Promise.reject(
        new DbError("POOL_CLOSED", "DuckDB pool is closed")
      );
    }
    return this.#instance.connect();
  }
}

function readerColumns(reader: ReaderLike): ColumnInfo[] {
  const names = reader.columnNames();
  return names.map((name, i) => ({
    name,
    typeName: reader.columnType(i).toString(),
  }));
}

function tryDisconnect(conn: DuckDBConnection): void {
  try {
    conn.disconnect();
  } catch {
    // already closed
  }
}

function bindAbort(conn: DuckDBConnection, signal: AbortSignal): () => void {
  let released = false;
  const releaseOnce = () => {
    if (released) {
      return;
    }
    released = true;
    tryDisconnect(conn);
  };
  if (signal.aborted) {
    try {
      conn.interrupt();
    } catch {
      // best-effort
    }
    releaseOnce();
    throw DbError.cancelled();
  }
  const onAbort = () => {
    try {
      conn.interrupt();
    } catch {
      // best-effort
    }
  };
  signal.addEventListener("abort", onAbort, { once: true });
  return () => {
    signal.removeEventListener("abort", onAbort);
    releaseOnce();
  };
}

async function runExplainJson(
  conn: DuckDBConnection,
  trimmed: string
): Promise<{ raw: string; json: unknown }> {
  const reader = await conn.runAndReadAll(`EXPLAIN (FORMAT JSON) ${trimmed}`);
  const rows = reader.getRowsJson();
  const [first] = rows;
  const value = Array.isArray(first) ? first.at(-1) : undefined;
  if (typeof value !== "string") {
    throw new DbError("EXPLAIN_NO_OUTPUT", "DuckDB EXPLAIN produced no output");
  }
  return { json: JSON.parse(value), raw: value };
}

async function runAnalyzeJson(
  conn: DuckDBConnection,
  trimmed: string
): Promise<{ raw: string; json: unknown }> {
  const profilePath = join(tmpdir(), `omq_duckdb_profile_${randomUUID()}.json`);
  await conn.run("PRAGMA enable_profiling = 'json'");
  await conn.run(
    `PRAGMA profiling_output = '${profilePath.replaceAll("'", "''")}'`
  );
  try {
    await conn.run(trimmed);
  } finally {
    try {
      await conn.run("PRAGMA disable_profiling");
    } catch {
      // best-effort
    }
  }
  let raw: string;
  try {
    raw = await readFile(profilePath, "utf8");
  } catch {
    throw new DbError(
      "EXPLAIN_NO_OUTPUT",
      "DuckDB ANALYZE produced no profile output"
    );
  }
  try {
    await unlink(profilePath);
  } catch {
    // file may already be gone
  }
  const json = JSON.parse(raw) as unknown;
  // The profile root wrapper carries timing for the whole query but no
  // operator name. Label it so parseDuckdb yields a "Query" root instead of
  // "Unknown".
  if (
    json !== null &&
    typeof json === "object" &&
    !Array.isArray(json) &&
    !("name" in json) &&
    !("operator_type" in json)
  ) {
    (json as Record<string, unknown>).name = "Query";
  }
  return { json, raw };
}

export function mapDuckdbError(err: unknown): DbError {
  if (err instanceof DbError) {
    return err;
  }
  const e = err as { code?: string; message?: string; name?: string };
  const stringified = String(err);
  const message =
    (typeof e.message === "string" && e.message.length > 0 && e.message) ||
    (stringified !== "[object Object]" && stringified) ||
    e.name ||
    "DuckDB error";
  return new DbError(e.code ?? "DB_ERROR", message);
}

interface RelationRow {
  table_name: string;
  table_type: string;
  estimated_size: string | number | null;
}

interface ColumnRow {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  column_default: string | null;
  is_pk: boolean;
}

interface IndexRow {
  table_name: string;
  index_name: string;
  is_unique: boolean;
  expressions: string | null;
}

interface ForeignKeyRow {
  table_name: string;
  constraint_name: string | null;
  constraint_column_names: string[];
  referenced_table: string | null;
  referenced_column_names: string[];
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
  conn: DuckDBConnection,
  schema: string
): Promise<RelationRow[]> {
  const reader = await conn.runAndReadAll(
    `SELECT t.table_name AS table_name,
            t.table_type AS table_type,
            dt.estimated_size AS estimated_size
       FROM information_schema.tables t
       LEFT JOIN duckdb_tables() dt
         ON dt.schema_name = t.table_schema
        AND dt.table_name  = t.table_name
       WHERE t.table_schema = $schema
       ORDER BY t.table_name`,
    { schema }
  );
  return reader.getRowObjectsJson() as unknown as RelationRow[];
}

async function fetchAllColumns(
  conn: DuckDBConnection,
  schema: string
): Promise<ColumnRow[]> {
  const reader = await conn.runAndReadAll(
    `WITH pk_columns AS (
       SELECT table_name, unnest(constraint_column_names) AS column_name
         FROM duckdb_constraints()
        WHERE schema_name = $schema
          AND constraint_type = 'PRIMARY KEY'
     )
     SELECT c.table_name      AS table_name,
            c.column_name     AS column_name,
            c.data_type       AS data_type,
            c.is_nullable     AS is_nullable,
            c.column_default  AS column_default,
            (pk.column_name IS NOT NULL) AS is_pk
       FROM duckdb_columns() c
       LEFT JOIN pk_columns pk
         ON pk.table_name  = c.table_name
        AND pk.column_name = c.column_name
       WHERE c.schema_name = $schema
       ORDER BY c.table_name, c.column_index`,
    { schema }
  );
  return reader.getRowObjectsJson() as unknown as ColumnRow[];
}

async function fetchAllIndexes(
  conn: DuckDBConnection,
  schema: string
): Promise<IndexRow[]> {
  const reader = await conn.runAndReadAll(
    `SELECT table_name, index_name, is_unique, expressions
       FROM duckdb_indexes()
      WHERE schema_name = $schema
        AND NOT is_primary
      ORDER BY table_name, index_name`,
    { schema }
  );
  return reader.getRowObjectsJson() as unknown as IndexRow[];
}

async function fetchAllForeignKeys(
  conn: DuckDBConnection,
  schema: string
): Promise<ForeignKeyRow[]> {
  const reader = await conn.runAndReadAll(
    `SELECT table_name,
            constraint_name,
            constraint_column_names,
            referenced_table,
            referenced_column_names
       FROM duckdb_constraints()
      WHERE schema_name = $schema
        AND constraint_type = 'FOREIGN KEY'
      ORDER BY table_name, constraint_name`,
    { schema }
  );
  return reader.getRowObjectsJson() as unknown as ForeignKeyRow[];
}

export function parseExpressionList(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  const trimmed = raw.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return [];
  }
  return trimmed
    .slice(1, -1)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function parseRowEstimate(raw: string | number | null): number | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  const est = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
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
    if (r.table_type === "VIEW") {
      views.set(r.table_name, { columns: [], name: r.table_name });
    } else {
      tables.set(r.table_name, {
        columns: [],
        foreignKeys: [],
        indexes: [],
        name: r.table_name,
        rowEstimate: parseRowEstimate(r.estimated_size),
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
      isNullable: Boolean(c.is_nullable),
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
      columns: parseExpressionList(i.expressions),
      isUnique: Boolean(i.is_unique),
      name: i.index_name,
    });
  }

  for (const f of foreignKeys) {
    const table = tables.get(f.table_name);
    if (!table || !f.referenced_table) {
      continue;
    }
    table.foreignKeys.push({
      columns: [...f.constraint_column_names],
      name: f.constraint_name ?? "",
      referencedColumns: [...f.referenced_column_names],
      referencedTable: f.referenced_table,
    });
  }

  return {
    tables: [...tables.values()],
    views: [...views.values()],
  };
}
