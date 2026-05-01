import type { ClickHouseClient } from "@clickhouse/client";
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

import { DbError, validateSchemaName } from "@oh-my-query/core";

const VIEW_ENGINES = new Set(["View", "MaterializedView", "LiveView"]);

interface TableRow {
  name: string;
  engine: string;
  total_rows: string | number | null;
}

interface ColumnRow {
  table: string;
  name: string;
  type: string;
  is_in_primary_key: number | string;
  default_expression: string | null;
}

interface DataSkippingIndexRow {
  table: string;
  name: string;
  index_type: string;
  expr: string;
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

interface JsonCompactResult {
  meta: { name: string; type: string }[];
  data: unknown[][];
  rows: number;
}

export interface ClickhousePoolOptions {
  defaultClient: ClickHouseClient;
  defaultDatabase: string;
  clientFor?: (database: string) => ClickHouseClient;
}

export class ClickhousePool implements Pool {
  readonly dialect: DialectType = "clickhouse";
  readonly supportsExplain = false;
  readonly #client: ClickHouseClient;
  readonly #defaultDatabase: string;
  readonly #clientFor: ((database: string) => ClickHouseClient) | null;
  readonly #extras = new Map<string, ClickHouseClient>();

  constructor(options: ClickhousePoolOptions) {
    this.#client = options.defaultClient;
    this.#defaultDatabase = options.defaultDatabase;
    this.#clientFor = options.clientFor ?? null;
  }

  get raw(): ClickHouseClient {
    return this.#client;
  }

  #clientForDatabase(database: string | null): ClickHouseClient {
    if (!database || database === this.#defaultDatabase || !this.#clientFor) {
      return this.#client;
    }
    const cached = this.#extras.get(database);
    if (cached) {
      return cached;
    }
    const fresh = this.#clientFor(database);
    this.#extras.set(database, fresh);
    return fresh;
  }

  async fetchVersion(): Promise<string> {
    try {
      const rs = await this.#client.query({
        format: "JSON",
        query: "SELECT version() AS version",
      });
      const json = (await rs.json()) as { data?: { version?: string }[] };
      const version = json.data?.[0]?.version ?? "";
      return version ? `ClickHouse ${version}` : "ClickHouse";
    } catch (error) {
      throw mapClickhouseError(error);
    }
  }

  async listDatabases(): Promise<string[]> {
    try {
      const rs = await this.#client.query({
        format: "JSON",
        query: `SELECT name FROM system.databases
                WHERE name NOT IN ('system', 'INFORMATION_SCHEMA', 'information_schema')
                ORDER BY name`,
      });
      const json = (await rs.json()) as { data?: { name: string }[] };
      return (json.data ?? []).map((row) => row.name);
    } catch (error) {
      throw mapClickhouseError(error);
    }
  }

  async fetchSchema(database: string): Promise<SchemaInfo> {
    validateSchemaName(database);
    try {
      const [tables, columns, indices] = await Promise.all([
        fetchTables(this.#client, database),
        fetchAllColumns(this.#client, database),
        fetchAllDataSkippingIndices(this.#client, database),
      ]);
      const built = buildSchemaItem(tables, columns, indices);
      return {
        schemas: [{ name: database, tables: built.tables, views: built.views }],
      };
    } catch (error) {
      throw mapClickhouseError(error);
    }
  }

  async execute(
    sql: string,
    maxRows: number,
    schema: string | null,
    signal: AbortSignal
  ): Promise<ExecuteResult> {
    if (signal.aborted) {
      throw DbError.cancelled();
    }
    try {
      const client = this.#clientForDatabase(schema);
      const rs = await client.query({
        abort_signal: signal,
        format: "JSONCompact",
        query: sql,
      });
      const json = (await rs.json()) as JsonCompactResult;
      const allRows = json.data ?? [];
      const isTruncated = allRows.length > maxRows;
      const rows = isTruncated ? allRows.slice(0, maxRows) : allRows;
      const columns: ColumnInfo[] = (json.meta ?? []).map((m) => ({
        name: m.name,
        typeName: m.type,
      }));
      return {
        columns,
        executionTimeMs: 0,
        isTruncated,
        resultType: "tabular",
        rowCount: rows.length,
        rows: rows.map(jsonifyRow) as never,
      };
    } catch (error) {
      throw mapClickhouseError(error);
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async explain(
    _sql: string,
    _analyze: boolean,
    _schema: string | null,
    _signal: AbortSignal
  ): Promise<ExplainResult> {
    throw new DbError(
      "NOT_IMPLEMENTED",
      `EXPLAIN is not yet supported for ${this.dialect}`
    );
  }

  async close(): Promise<void> {
    const clients = [this.#client, ...this.#extras.values()];
    this.#extras.clear();
    await Promise.all(
      clients.map(async (c) => {
        try {
          await c.close();
        } catch {
          // best-effort close
        }
      })
    );
  }
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

function parseRowEstimate(raw: string | number | null): number | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  const parsed =
    typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function unwrapNullable(type: string): {
  dataType: string;
  isNullable: boolean;
} {
  const match = /^Nullable\((.*)\)$/.exec(type);
  if (match) {
    return { dataType: match[1] ?? type, isNullable: true };
  }
  return { dataType: type, isNullable: false };
}

async function fetchTables(
  client: ClickHouseClient,
  database: string
): Promise<TableRow[]> {
  const rs = await client.query({
    format: "JSON",
    query: `SELECT name, engine, total_rows
            FROM system.tables
            WHERE database = {database:String} AND is_temporary = 0
            ORDER BY name`,
    query_params: { database },
  });
  const json = (await rs.json()) as { data?: TableRow[] };
  return json.data ?? [];
}

async function fetchAllColumns(
  client: ClickHouseClient,
  database: string
): Promise<ColumnRow[]> {
  const rs = await client.query({
    format: "JSON",
    query: `SELECT table, name, type, is_in_primary_key, default_expression
            FROM system.columns
            WHERE database = {database:String}
            ORDER BY table, position`,
    query_params: { database },
  });
  const json = (await rs.json()) as { data?: ColumnRow[] };
  return json.data ?? [];
}

async function fetchAllDataSkippingIndices(
  client: ClickHouseClient,
  database: string
): Promise<DataSkippingIndexRow[]> {
  const rs = await client.query({
    format: "JSON",
    query: `SELECT table, name, type AS index_type, expr
            FROM system.data_skipping_indices
            WHERE database = {database:String}
            ORDER BY table, name`,
    query_params: { database },
  });
  const json = (await rs.json()) as { data?: DataSkippingIndexRow[] };
  return json.data ?? [];
}

function buildSchemaItem(
  relations: TableRow[],
  columns: ColumnRow[],
  indices: DataSkippingIndexRow[]
): { tables: TableLike[]; views: ViewLike[] } {
  const tables = new Map<string, TableLike>();
  const views = new Map<string, ViewLike>();

  for (const r of relations) {
    if (VIEW_ENGINES.has(r.engine)) {
      views.set(r.name, { columns: [], name: r.name });
    } else {
      tables.set(r.name, {
        columns: [],
        foreignKeys: [],
        indexes: [],
        name: r.name,
        rowEstimate: parseRowEstimate(r.total_rows),
      });
    }
  }

  for (const c of columns) {
    const target = tables.get(c.table) ?? views.get(c.table);
    if (!target) {
      continue;
    }
    const { dataType, isNullable } = unwrapNullable(c.type);
    target.columns.push({
      dataType,
      defaultValue:
        c.default_expression && c.default_expression.length > 0
          ? c.default_expression
          : null,
      isNullable,
      isPrimaryKey: c.is_in_primary_key === 1 || c.is_in_primary_key === "1",
      name: c.name,
    });
  }

  for (const i of indices) {
    const table = tables.get(i.table);
    if (!table) {
      continue;
    }
    table.indexes.push({
      columns: [i.expr],
      isUnique: false,
      name: i.name,
    });
  }

  return {
    tables: [...tables.values()],
    views: [...views.values()],
  };
}

export function mapClickhouseError(err: unknown): DbError {
  if (err instanceof DbError) {
    return err;
  }
  if (err instanceof AggregateError && err.errors.length > 0) {
    const [inner, ...rest] = err.errors;
    const mapped = mapClickhouseError(inner);
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
