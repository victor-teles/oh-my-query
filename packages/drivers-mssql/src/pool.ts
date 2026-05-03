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
  TableItem,
  ViewItem,
} from "@oh-my-query/core";
import type {
  ConnectionPool,
  IColumnMetadata,
  IResult,
  ISqlType,
  Request as MssqlRequest,
} from "mssql";

import { DbError, validateSchemaName } from "@oh-my-query/core";

const POOL_CLOSED = new DbError("POOL_CLOSED", "MSSQL pool is closed");

export function mapMssqlError(err: unknown): DbError {
  if (err instanceof DbError) {
    return err;
  }
  const e = err as { code?: string; message?: string; name?: string };
  const stringified = String(err);
  const message =
    (typeof e.message === "string" && e.message.length > 0 && e.message) ||
    (stringified !== "[object Object]" && stringified) ||
    e.name ||
    "MSSQL error";
  return new DbError(e.code ?? "DB_ERROR", message);
}

interface RelationRow {
  TABLE_NAME: string;
  TABLE_TYPE: string;
}

interface ColumnRow {
  TABLE_NAME: string;
  COLUMN_NAME: string;
  DATA_TYPE: string;
  IS_NULLABLE: string;
  COLUMN_DEFAULT: string | null;
  IS_PRIMARY_KEY: number | boolean;
}

interface IndexRow {
  TABLE_NAME: string;
  INDEX_NAME: string;
  IS_UNIQUE: number | boolean;
  COLUMN_NAME: string;
  KEY_ORDINAL: number;
}

interface ForeignKeyRow {
  TABLE_NAME: string;
  CONSTRAINT_NAME: string;
  ORDINAL: number;
  COLUMN_NAME: string;
  REFERENCED_TABLE_NAME: string;
  REFERENCED_COLUMN_NAME: string;
}

function typeNameOf(meta: IColumnMetadata[string]): string {
  const factory = meta.type;
  const sqlType: ISqlType = typeof factory === "function" ? factory() : factory;
  const declaration = (sqlType as { type?: { declaration?: string } }).type
    ?.declaration;
  if (typeof declaration === "string" && declaration.length > 0) {
    return declaration;
  }
  return "";
}

function metadataToColumns(metadata: IColumnMetadata): ColumnInfo[] {
  const entries = Object.values(metadata) as IColumnMetadata[string][];
  entries.sort((a, b) => a.index - b.index);
  return entries.map((m) => ({ name: m.name, typeName: typeNameOf(m) }));
}

function recordToRow(
  row: Record<string, unknown>,
  columns: ColumnInfo[]
): unknown[] {
  return columns.map((c) => row[c.name] ?? null);
}

function isYes(value: unknown): boolean {
  if (typeof value === "string") {
    return value.toUpperCase() === "YES";
  }
  return Boolean(value);
}

function quoteIdentifier(name: string): string {
  return `[${name.replaceAll("]", "]]")}]`;
}

export class MssqlPool implements Pool {
  readonly dialect: DialectType = "tsql";
  readonly supportsExplain = false;
  #pool: ConnectionPool | null;
  readonly #defaultDatabase: string;

  constructor(pool: ConnectionPool, defaultDatabase: string) {
    this.#pool = pool;
    this.#defaultDatabase = defaultDatabase;
  }

  get defaultDatabase(): string {
    return this.#defaultDatabase;
  }

  async fetchVersion(): Promise<string> {
    try {
      const pool = this.#requirePool();
      const r = await pool.query("SELECT @@VERSION AS version");
      const raw = r.recordset?.[0]?.version;
      const text = typeof raw === "string" ? raw : "";
      if (!text) {
        return "";
      }
      const firstLine = text.split(/\r?\n/)[0]?.trim() ?? "";
      return firstLine;
    } catch (error) {
      throw mapMssqlError(error);
    }
  }

  async listDatabases(): Promise<string[]> {
    try {
      const pool = this.#requirePool();
      const r = await pool.query(
        `SELECT name FROM sys.databases
         WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb')
         ORDER BY name`
      );
      const rows = (r.recordset ?? []) as { name?: string }[];
      return rows
        .map((row) => row.name)
        .filter((n): n is string => typeof n === "string");
    } catch (error) {
      throw mapMssqlError(error);
    }
  }

  async fetchSchema(database: string): Promise<SchemaInfo> {
    validateSchemaName(database);
    try {
      const pool = this.#requirePool();
      const [relations, columns, indexes, foreignKeys] = await Promise.all([
        fetchRelations(pool, database),
        fetchColumns(pool, database),
        fetchIndexes(pool, database),
        fetchForeignKeys(pool, database),
      ]);
      const { tables, views } = buildSchemaItems(
        relations,
        columns,
        indexes,
        foreignKeys
      );
      return { schemas: [{ name: database, tables, views }] };
    } catch (error) {
      throw mapMssqlError(error);
    }
  }

  async execute(
    sql: string,
    maxRows: number,
    schema: string | null,
    signal: AbortSignal
  ): Promise<ExecuteResult> {
    if (signal.aborted) {
      throw signal.reason instanceof DbError
        ? signal.reason
        : DbError.cancelled();
    }
    if (schema) {
      validateSchemaName(schema);
    }
    const pool = this.#requirePool();
    const request = pool.request();
    const onAbort = () => {
      try {
        request.cancel();
      } catch {
        // best-effort
      }
    };
    signal.addEventListener("abort", onAbort, { once: true });
    try {
      if (schema) {
        await request.query(`USE ${quoteIdentifier(schema)}`);
      }
      const result = await request.query(sql);
      return shapeExecuteResult(result, maxRows);
    } catch (error) {
      if (signal.aborted) {
        throw signal.reason instanceof DbError
          ? signal.reason
          : DbError.cancelled();
      }
      throw mapMssqlError(error);
    } finally {
      signal.removeEventListener("abort", onAbort);
    }
  }

  explain(
    _sql: string,
    _analyze: boolean,
    _schema: string | null,
    _signal: AbortSignal
  ): Promise<ExplainResult> {
    return Promise.reject(
      DbError.unsupported(`${this.dialect} does not support EXPLAIN`)
    );
  }

  async close(): Promise<void> {
    const pool = this.#pool;
    if (!pool) {
      return;
    }
    this.#pool = null;
    try {
      await pool.close();
    } catch {
      // pool may already be closing
    }
  }

  #requirePool(): ConnectionPool {
    if (!this.#pool) {
      throw POOL_CLOSED;
    }
    return this.#pool;
  }
}

function shapeExecuteResult(
  result: IResult<unknown>,
  maxRows: number
): ExecuteResult {
  const recordset = result.recordset as
    | (Record<string, unknown>[] & { columns?: IColumnMetadata })
    | undefined;
  if (!recordset) {
    const totalAffected = (result.rowsAffected ?? []).reduce(
      (sum, n) => sum + n,
      0
    );
    return {
      columns: [],
      executionTimeMs: 0,
      isTruncated: false,
      resultType: "tabular",
      rowCount: totalAffected,
      rows: [],
    };
  }
  const columns = recordset.columns
    ? metadataToColumns(recordset.columns)
    : Object.keys(recordset[0] ?? {}).map((name) => ({ name, typeName: "" }));
  const isTruncated = recordset.length > maxRows;
  const trimmed = isTruncated ? recordset.slice(0, maxRows) : recordset;
  const rows = trimmed.map((row) => recordToRow(row, columns));
  return {
    columns,
    executionTimeMs: 0,
    isTruncated,
    resultType: "tabular",
    rowCount: rows.length,
    rows,
  };
}

async function fetchRelations(
  pool: ConnectionPool,
  database: string
): Promise<RelationRow[]> {
  const r = await pool.query(
    `SELECT TABLE_NAME, TABLE_TYPE
     FROM ${quoteIdentifier(database)}.INFORMATION_SCHEMA.TABLES
     ORDER BY TABLE_NAME`
  );
  return (r.recordset ?? []) as unknown as RelationRow[];
}

async function fetchColumns(
  pool: ConnectionPool,
  database: string
): Promise<ColumnRow[]> {
  const dbName = quoteIdentifier(database);
  const r = await pool.query(
    `SELECT c.TABLE_NAME, c.COLUMN_NAME, c.DATA_TYPE, c.IS_NULLABLE,
            c.COLUMN_DEFAULT,
            CASE WHEN pk.COLUMN_NAME IS NULL THEN 0 ELSE 1 END AS IS_PRIMARY_KEY
     FROM ${dbName}.INFORMATION_SCHEMA.COLUMNS c
     LEFT JOIN (
       SELECT kcu.TABLE_NAME, kcu.COLUMN_NAME
       FROM ${dbName}.INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
       JOIN ${dbName}.INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
         ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
       WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
     ) pk
       ON pk.TABLE_NAME = c.TABLE_NAME AND pk.COLUMN_NAME = c.COLUMN_NAME
     ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION`
  );
  return (r.recordset ?? []) as unknown as ColumnRow[];
}

async function fetchIndexes(
  pool: ConnectionPool,
  database: string
): Promise<IndexRow[]> {
  const dbName = quoteIdentifier(database);
  const r = await pool.query(
    `SELECT t.name AS TABLE_NAME, i.name AS INDEX_NAME, i.is_unique AS IS_UNIQUE,
            c.name AS COLUMN_NAME, ic.key_ordinal AS KEY_ORDINAL
     FROM ${dbName}.sys.indexes i
     JOIN ${dbName}.sys.index_columns ic
       ON i.object_id = ic.object_id AND i.index_id = ic.index_id
     JOIN ${dbName}.sys.columns c
       ON ic.object_id = c.object_id AND ic.column_id = c.column_id
     JOIN ${dbName}.sys.tables t ON i.object_id = t.object_id
     WHERE i.is_primary_key = 0 AND i.is_hypothetical = 0 AND i.name IS NOT NULL
     ORDER BY t.name, i.name, ic.key_ordinal`
  );
  return (r.recordset ?? []) as unknown as IndexRow[];
}

async function fetchForeignKeys(
  pool: ConnectionPool,
  database: string
): Promise<ForeignKeyRow[]> {
  const dbName = quoteIdentifier(database);
  const r = await pool.query(
    `SELECT t.name AS TABLE_NAME, fk.name AS CONSTRAINT_NAME,
            fkc.constraint_column_id AS ORDINAL,
            c.name AS COLUMN_NAME,
            rt.name AS REFERENCED_TABLE_NAME,
            rc.name AS REFERENCED_COLUMN_NAME
     FROM ${dbName}.sys.foreign_keys fk
     JOIN ${dbName}.sys.foreign_key_columns fkc
       ON fk.object_id = fkc.constraint_object_id
     JOIN ${dbName}.sys.tables t ON fk.parent_object_id = t.object_id
     JOIN ${dbName}.sys.columns c
       ON fkc.parent_object_id = c.object_id
       AND fkc.parent_column_id = c.column_id
     JOIN ${dbName}.sys.tables rt ON fk.referenced_object_id = rt.object_id
     JOIN ${dbName}.sys.columns rc
       ON fkc.referenced_object_id = rc.object_id
       AND fkc.referenced_column_id = rc.column_id
     ORDER BY t.name, fk.name, fkc.constraint_column_id`
  );
  return (r.recordset ?? []) as unknown as ForeignKeyRow[];
}

function buildSchemaItems(
  relations: RelationRow[],
  columns: ColumnRow[],
  indexes: IndexRow[],
  foreignKeys: ForeignKeyRow[]
): { tables: TableItem[]; views: ViewItem[] } {
  const colsByTable = groupBy(columns, (c) => c.TABLE_NAME);
  const idxByTable = groupBy(indexes, (i) => i.TABLE_NAME);
  const fksByTable = groupBy(foreignKeys, (f) => f.TABLE_NAME);

  const tables: TableItem[] = [];
  const views: ViewItem[] = [];
  for (const rel of relations) {
    const tableColumns = (colsByTable.get(rel.TABLE_NAME) ?? []).map(
      toColumnDetail
    );
    if (rel.TABLE_TYPE === "VIEW") {
      views.push({ columns: tableColumns, name: rel.TABLE_NAME });
    } else {
      tables.push({
        columns: tableColumns,
        foreignKeys: shapeForeignKeys(fksByTable.get(rel.TABLE_NAME) ?? []),
        indexes: shapeIndexes(idxByTable.get(rel.TABLE_NAME) ?? []),
        name: rel.TABLE_NAME,
        rowEstimate: null,
      });
    }
  }
  return { tables, views };
}

function toColumnDetail(c: ColumnRow): ColumnDetail {
  return {
    dataType: c.DATA_TYPE,
    defaultValue: c.COLUMN_DEFAULT,
    isNullable: isYes(c.IS_NULLABLE),
    isPrimaryKey: Boolean(c.IS_PRIMARY_KEY),
    name: c.COLUMN_NAME,
  };
}

function shapeIndexes(rows: IndexRow[]): IndexItem[] {
  const grouped = new Map<string, IndexRow[]>();
  for (const r of rows) {
    const list = grouped.get(r.INDEX_NAME) ?? [];
    list.push(r);
    grouped.set(r.INDEX_NAME, list);
  }
  return [...grouped.entries()].map(([name, group]) => {
    const ordered = [...group].toSorted(
      (a, b) => a.KEY_ORDINAL - b.KEY_ORDINAL
    );
    return {
      columns: ordered.map((g) => g.COLUMN_NAME),
      isUnique: Boolean(group[0]?.IS_UNIQUE),
      name,
    };
  });
}

function shapeForeignKeys(rows: ForeignKeyRow[]): ForeignKeyItem[] {
  const grouped = new Map<string, ForeignKeyRow[]>();
  for (const r of rows) {
    const list = grouped.get(r.CONSTRAINT_NAME) ?? [];
    list.push(r);
    grouped.set(r.CONSTRAINT_NAME, list);
  }
  return [...grouped.entries()].map(([name, group]) => {
    const ordered = [...group].toSorted((a, b) => a.ORDINAL - b.ORDINAL);
    return {
      columns: ordered.map((g) => g.COLUMN_NAME),
      name,
      referencedColumns: ordered.map((g) => g.REFERENCED_COLUMN_NAME),
      referencedTable: ordered[0]?.REFERENCED_TABLE_NAME ?? "",
    };
  });
}

function groupBy<T, K>(arr: T[], keyOf: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of arr) {
    const key = keyOf(item);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

export type { MssqlRequest };
