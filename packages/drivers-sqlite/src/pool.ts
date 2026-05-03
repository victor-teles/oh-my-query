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
import type { Database, Statement } from "bun:sqlite";

import { DbError, validateSchemaName } from "@oh-my-query/core";

const POOL_CLOSED = new DbError("POOL_CLOSED", "SQLite pool is closed");

export function mapSqliteError(err: unknown): DbError {
  if (err instanceof DbError) {
    return err;
  }
  const e = err as { code?: string; message?: string; name?: string };
  const stringified = String(err);
  const message =
    (typeof e.message === "string" && e.message.length > 0 && e.message) ||
    (stringified !== "[object Object]" && stringified) ||
    e.name ||
    "SQLite error";
  return new DbError(e.code ?? "DB_ERROR", message);
}

interface DatabaseRow {
  name: string;
}

interface RelationRow {
  name: string;
  type: string;
}

interface ColumnRow {
  cid: number;
  name: string;
  type: string | null;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

interface IndexRow {
  seq: number;
  name: string;
  unique: number;
  origin: string;
  partial: number;
}

interface IndexInfoRow {
  seqno: number;
  cid: number;
  name: string;
}

interface ForeignKeyRow {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
}

function coerceCell(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
}

function rowsToColumns(
  columnNames: string[],
  types: (string | null)[]
): ColumnInfo[] {
  return columnNames.map((name, i) => ({
    name,
    typeName: types[i] ?? "",
  }));
}

export class SqlitePool implements Pool {
  readonly dialect: DialectType = "sqlite";
  readonly supportsExplain = false;
  #db: Database | null;
  readonly #engine: string;

  constructor(db: Database, engine: string) {
    this.#db = db;
    this.#engine = engine;
  }

  get engine(): string {
    return this.#engine;
  }

  fetchVersion(): Promise<string> {
    try {
      const db = this.#requireDb();
      const stmt = db.query("SELECT sqlite_version() AS sqlite_version");
      const row = stmt.get() as { sqlite_version?: string } | null;
      const version = row?.sqlite_version;
      return Promise.resolve(version ? `SQLite ${version}` : "");
    } catch (error) {
      return Promise.reject(mapSqliteError(error));
    }
  }

  listDatabases(): Promise<string[]> {
    try {
      const db = this.#requireDb();
      const stmt = db.query("PRAGMA database_list");
      const rows = stmt.all() as DatabaseRow[];
      const names = rows
        .map((r) => r.name)
        .filter((n): n is string => typeof n === "string");
      return Promise.resolve(names.length > 0 ? names : ["main"]);
    } catch {
      return Promise.resolve(["main"]);
    }
  }

  fetchSchema(database: string): Promise<SchemaInfo> {
    try {
      validateSchemaName(database);
      const db = this.#requireDb();
      const relations = fetchRelations(db);
      const tables: TableItem[] = [];
      const views: ViewItem[] = [];
      for (const rel of relations) {
        const columns = fetchColumns(db, rel.name);
        if (rel.type === "view") {
          views.push({ columns, name: rel.name });
        } else {
          tables.push({
            columns,
            foreignKeys: fetchForeignKeys(db, rel.name),
            indexes: fetchIndexes(db, rel.name),
            name: rel.name,
            rowEstimate: null,
          });
        }
      }
      return Promise.resolve({
        schemas: [{ name: database, tables, views }],
      });
    } catch (error) {
      return Promise.reject(mapSqliteError(error));
    }
  }

  execute(
    sql: string,
    maxRows: number,
    _schema: string | null,
    signal: AbortSignal
  ): Promise<ExecuteResult> {
    if (signal.aborted) {
      return Promise.reject(
        signal.reason instanceof DbError ? signal.reason : DbError.cancelled()
      );
    }
    const start = performance.now();
    try {
      const db = this.#requireDb();
      const stmt = db.query<unknown, []>(sql);
      const { columnNames } = stmt;
      if (columnNames.length === 0) {
        const changes = stmt.run();
        return Promise.resolve({
          columns: [],
          executionTimeMs: Math.round(performance.now() - start),
          isTruncated: false,
          resultType: "tabular",
          rowCount: changes.changes,
          rows: [],
        });
      }
      const allRows = stmt.values() as unknown[][];
      const { columnTypes } = stmt;
      const isTruncated = allRows.length > maxRows;
      const rows = (isTruncated ? allRows.slice(0, maxRows) : allRows).map(
        (row) => row.map(coerceCell)
      );
      return Promise.resolve({
        columns: rowsToColumns(columnNames, columnTypes),
        executionTimeMs: Math.round(performance.now() - start),
        isTruncated,
        resultType: "tabular",
        rowCount: rows.length,
        rows,
      });
    } catch (error) {
      return Promise.reject(mapSqliteError(error));
    }
  }

  explain(
    _sql: string,
    _analyze: boolean,
    _schema: string | null,
    _signal: AbortSignal
  ): Promise<ExplainResult> {
    return Promise.reject(
      DbError.unsupported(`${this.#engine} does not support EXPLAIN`)
    );
  }

  close(): Promise<void> {
    const db = this.#db;
    if (!db) {
      return Promise.resolve();
    }
    this.#db = null;
    try {
      db.close();
    } catch {
      // already closed
    }
    return Promise.resolve();
  }

  #requireDb(): Database {
    if (!this.#db) {
      throw POOL_CLOSED;
    }
    return this.#db;
  }
}

function fetchRelations(db: Database): RelationRow[] {
  const stmt = db.query(
    `SELECT name, type FROM sqlite_master
     WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
     ORDER BY name`
  );
  return stmt.all() as RelationRow[];
}

function fetchColumns(db: Database, table: string): ColumnDetail[] {
  const stmt = db.query(
    `SELECT cid, name, "type" AS type, "notnull" AS notnull, dflt_value, pk
     FROM pragma_table_info(?) ORDER BY cid`
  ) as Statement<ColumnRow, [string]>;
  const rows = stmt.all(table);
  return rows.map((r) => ({
    dataType: r.type ?? "",
    defaultValue: r.dflt_value ?? null,
    isNullable: r.notnull === 0,
    isPrimaryKey: r.pk > 0,
    name: r.name,
  }));
}

function fetchIndexes(db: Database, table: string): IndexItem[] {
  const listStmt = db.query(
    `SELECT seq, name, "unique" AS "unique", origin, partial
     FROM pragma_index_list(?)
     ORDER BY seq`
  ) as Statement<IndexRow, [string]>;
  const indexes = listStmt.all(table);
  const out: IndexItem[] = [];
  for (const idx of indexes) {
    if (idx.origin === "pk") {
      continue;
    }
    const infoStmt = db.query(
      `SELECT seqno, cid, name FROM pragma_index_info(?) ORDER BY seqno`
    ) as Statement<IndexInfoRow, [string]>;
    const info = infoStmt.all(idx.name);
    out.push({
      columns: info.map((c) => c.name),
      isUnique: idx.unique === 1,
      name: idx.name,
    });
  }
  return out;
}

function fetchForeignKeys(db: Database, table: string): ForeignKeyItem[] {
  const stmt = db.query(
    `SELECT id, seq, "table" AS "table", "from" AS "from", "to" AS "to"
     FROM pragma_foreign_key_list(?)
     ORDER BY id, seq`
  ) as Statement<ForeignKeyRow, [string]>;
  const rows = stmt.all(table);
  const grouped = new Map<number, ForeignKeyRow[]>();
  for (const r of rows) {
    const list = grouped.get(r.id) ?? [];
    list.push(r);
    grouped.set(r.id, list);
  }
  const out: ForeignKeyItem[] = [];
  for (const [id, group] of grouped) {
    out.push({
      columns: group.map((g) => g.from),
      name: `${table}_fk_${id}`,
      referencedColumns: group.map((g) => g.to),
      referencedTable: group[0]?.table ?? "",
    });
  }
  return out;
}
