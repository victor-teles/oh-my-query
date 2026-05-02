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
import type {
  FieldPacket,
  Pool as MysqlPoolType,
  PoolConnection,
  RowDataPacket,
} from "mysql2/promise";

import { DbError, parseMysql, validateSchemaName } from "@oh-my-query/core";

const TYPE_NAMES: Record<number, string> = {
  0: "DECIMAL",
  1: "TINY",
  10: "DATE",
  11: "TIME",
  12: "DATETIME",
  13: "YEAR",
  14: "NEWDATE",
  15: "VARCHAR",
  16: "BIT",
  2: "SHORT",
  242: "VECTOR",
  245: "JSON",
  246: "NEWDECIMAL",
  247: "ENUM",
  248: "SET",
  249: "TINY_BLOB",
  250: "MEDIUM_BLOB",
  251: "LONG_BLOB",
  252: "BLOB",
  253: "VAR_STRING",
  254: "STRING",
  255: "GEOMETRY",
  3: "LONG",
  4: "FLOAT",
  5: "DOUBLE",
  6: "NULL",
  7: "TIMESTAMP",
  8: "LONGLONG",
  9: "INT24",
};

function typeNameForCode(code: number | undefined): string {
  if (code === undefined) {
    return "UNKNOWN";
  }
  return TYPE_NAMES[code] ?? `TYPE_${code}`;
}

export class MysqlPool implements Pool {
  readonly dialect: DialectType = "mysql";
  readonly supportsExplain = true;
  readonly #pool: MysqlPoolType;
  readonly #defaultDatabase: string;

  constructor(pool: MysqlPoolType, defaultDatabase: string) {
    this.#pool = pool;
    this.#defaultDatabase = defaultDatabase;
  }

  get raw(): MysqlPoolType {
    return this.#pool;
  }

  async fetchVersion(): Promise<string> {
    try {
      const [rows] = await this.#pool.query<RowDataPacket[]>(
        "SELECT VERSION() AS version"
      );
      const raw = rows[0]?.version;
      const version = typeof raw === "string" ? raw : "";
      return version ? `MySQL ${version}` : "MySQL";
    } catch (error) {
      throw mapMysqlError(error);
    }
  }

  async listDatabases(): Promise<string[]> {
    try {
      const [rows] = await this.#pool.query<RowDataPacket[]>(
        `SELECT schema_name AS name
         FROM information_schema.schemata
         WHERE schema_name NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys')
         ORDER BY schema_name`
      );
      return rows
        .map((r) => r.name)
        .filter((n): n is string => typeof n === "string");
    } catch (error) {
      throw mapMysqlError(error);
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
      throw mapMysqlError(error);
    }
  }

  async execute(
    sql: string,
    maxRows: number,
    schema: string | null,
    signal: AbortSignal
  ): Promise<ExecuteResult> {
    const conn = await this.#pool.getConnection();
    const release = bindAbort(conn, signal);
    try {
      if (schema) {
        validateSchemaName(schema);
        await conn.query(`USE \`${schema}\``);
      }
      let rows: unknown[][];
      let columns: ColumnInfo[];
      let isTruncated = false;
      try {
        const [rawRows, fields] = await conn.query<RowDataPacket[]>({
          rowsAsArray: true,
          sql,
        });
        const rowList = Array.isArray(rawRows) ? rawRows : [];
        if (rowList.length > maxRows) {
          rows = rowList.slice(0, maxRows) as unknown[][];
          isTruncated = true;
        } else {
          rows = rowList as unknown[][];
        }
        columns = (fields ?? []).map(toColumnInfo);
      } finally {
        if (schema && !signal.aborted) {
          try {
            await conn.query(`USE \`${this.#defaultDatabase}\``);
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
      if (signal.aborted && signal.reason instanceof DbError) {
        throw signal.reason;
      }
      throw mapMysqlError(error);
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
      throw DbError.unsupported(
        "EXPLAIN ANALYZE is not supported for MySQL. Turn off ANALYZE to see the estimated plan."
      );
    }
    const wrapped = `EXPLAIN FORMAT=JSON ${trimmed}`;

    const conn = await this.#pool.getConnection();
    const release = bindAbort(conn, signal);
    const start = performance.now();
    try {
      if (schema) {
        validateSchemaName(schema);
        await conn.query(`USE \`${schema}\``);
      }
      try {
        const [rows] = await conn.query<RowDataPacket[]>(wrapped);
        const rawCol = rows[0]?.EXPLAIN ?? rows[0]?.explain;
        const rawJson =
          typeof rawCol === "string" ? rawCol : JSON.stringify(rawCol ?? null);
        const parsed: unknown = JSON.parse(rawJson);
        const root = parseMysql(parsed as never);
        return {
          analyzeRan: false,
          engine: "mysql",
          executionTimeMs: Math.round(performance.now() - start),
          raw: JSON.stringify(parsed, null, 2),
          root,
          supportsAnalyze: false,
        };
      } finally {
        if (schema && !signal.aborted) {
          try {
            await conn.query(`USE \`${this.#defaultDatabase}\``);
          } catch {
            // best-effort
          }
        }
      }
    } catch (error) {
      if (signal.aborted && signal.reason instanceof DbError) {
        throw signal.reason;
      }
      throw mapMysqlError(error);
    } finally {
      release();
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

function toColumnInfo(field: FieldPacket): ColumnInfo {
  const code = field.columnType ?? field.type;
  return { name: field.name, typeName: typeNameForCode(code) };
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
    return `0x${v.toString("hex")}`;
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

function bindAbort(conn: PoolConnection, signal: AbortSignal): () => void {
  let released = false;
  const releaseOnce = (destroy: boolean) => {
    if (released) {
      return;
    }
    released = true;
    try {
      if (destroy) {
        conn.destroy();
      } else {
        conn.release();
      }
    } catch {
      // pool may have already reaped the connection
    }
  };
  if (signal.aborted) {
    releaseOnce(true);
    throw DbError.cancelled();
  }
  signal.addEventListener("abort", () => releaseOnce(true), { once: true });
  return () => releaseOnce(false);
}

export function mapMysqlError(err: unknown): DbError {
  if (err instanceof DbError) {
    return err;
  }
  if (err instanceof AggregateError && err.errors.length > 0) {
    const [inner, ...rest] = err.errors;
    const mapped = mapMysqlError(inner);
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
  const e = err as {
    code?: string;
    errno?: number;
    sqlMessage?: string;
    sqlState?: string;
    message?: string;
    name?: string;
  };
  const code = e.code ?? (e.errno !== undefined ? `ER_${e.errno}` : "DB_ERROR");
  const stringified = String(err);
  const message =
    (typeof e.sqlMessage === "string" &&
      e.sqlMessage.length > 0 &&
      e.sqlMessage) ||
    (typeof e.message === "string" && e.message.length > 0 && e.message) ||
    (stringified !== "[object Object]" && stringified) ||
    e.name ||
    code;
  return new DbError(code, message);
}

interface RelationRow {
  table_name: string;
  table_type: string;
  table_rows: string | number | null;
}

interface ColumnRow {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  column_key: string;
}

interface IndexRow {
  table_name: string;
  index_name: string;
  non_unique: number | string;
  column_name: string | null;
  seq_in_index: number | string;
}

interface ForeignKeyRow {
  table_name: string;
  constraint_name: string;
  column_name: string;
  referenced_table_name: string;
  referenced_column_name: string;
  ordinal_position: number | string;
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
  pool: MysqlPoolType,
  schema: string
): Promise<RelationRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT table_name, table_type, table_rows
     FROM information_schema.tables
     WHERE table_schema = ?
     ORDER BY table_name`,
    [schema]
  );
  return rows as unknown as RelationRow[];
}

async function fetchAllColumns(
  pool: MysqlPoolType,
  schema: string
): Promise<ColumnRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT table_name, column_name, data_type, is_nullable,
            column_default, column_key
     FROM information_schema.columns
     WHERE table_schema = ?
     ORDER BY table_name, ordinal_position`,
    [schema]
  );
  return rows as unknown as ColumnRow[];
}

async function fetchAllIndexes(
  pool: MysqlPoolType,
  schema: string
): Promise<IndexRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT table_name, index_name, non_unique, column_name, seq_in_index
     FROM information_schema.statistics
     WHERE table_schema = ? AND index_name <> 'PRIMARY'
     ORDER BY table_name, index_name, seq_in_index`,
    [schema]
  );
  return rows as unknown as IndexRow[];
}

async function fetchAllForeignKeys(
  pool: MysqlPoolType,
  schema: string
): Promise<ForeignKeyRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT table_name, constraint_name, column_name,
            referenced_table_name, referenced_column_name, ordinal_position
     FROM information_schema.key_column_usage
     WHERE table_schema = ? AND referenced_table_name IS NOT NULL
     ORDER BY table_name, constraint_name, ordinal_position`,
    [schema]
  );
  return rows as unknown as ForeignKeyRow[];
}

function parseRowEstimate(raw: string | number | null): number | null {
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
        rowEstimate: parseRowEstimate(r.table_rows),
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
      isPrimaryKey: c.column_key === "PRI",
      name: c.column_name,
    });
  }

  const indexByTable = new Map<string, Map<string, IndexItem>>();
  for (const i of indexes) {
    if (!tables.has(i.table_name)) {
      continue;
    }
    let perTable = indexByTable.get(i.table_name);
    if (!perTable) {
      perTable = new Map<string, IndexItem>();
      indexByTable.set(i.table_name, perTable);
    }
    let entry = perTable.get(i.index_name);
    if (!entry) {
      const nonUnique =
        typeof i.non_unique === "number"
          ? i.non_unique
          : Number.parseInt(String(i.non_unique), 10);
      entry = {
        columns: [],
        isUnique: nonUnique === 0,
        name: i.index_name,
      };
      perTable.set(i.index_name, entry);
    }
    if (typeof i.column_name === "string") {
      entry.columns.push(i.column_name);
    }
  }
  for (const [tableName, perTable] of indexByTable) {
    const table = tables.get(tableName);
    if (table) {
      table.indexes = [...perTable.values()];
    }
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
        referencedTable: f.referenced_table_name,
      };
      perTable.set(f.constraint_name, entry);
    }
    entry.columns.push(f.column_name);
    entry.referencedColumns.push(f.referenced_column_name);
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
