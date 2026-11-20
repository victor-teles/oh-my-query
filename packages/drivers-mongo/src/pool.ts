import type {
  ColumnDetail,
  ExecuteResult,
  ExplainResult,
  IndexItem,
  Pool,
  SchemaInfo,
  TableItem,
  ViewItem,
} from "@oh-my-query/core";
import type { Collection, MongoClient } from "mongodb";

import { DbError } from "@oh-my-query/core";

import {
  SAMPLE_SIZE,
  SAMPLE_TIMEOUT_MS,
  sampleFields,
} from "./schema-sample.ts";

const POOL_CLOSED = new DbError("POOL_CLOSED", "MongoDB pool is closed");
const MAX_SAMPLED_COLLECTIONS = 100;
const SAMPLE_CONCURRENCY = 4;

interface MongoIndexLike {
  name?: string;
  key?: Record<string, unknown>;
  unique?: boolean;
}

interface MongoCollectionInfoLike {
  name: string;
  type?: string;
}

function toIndexItem(index: MongoIndexLike): IndexItem {
  return {
    columns: index.key ? Object.keys(index.key) : [],
    isUnique: Boolean(index.unique),
    name: index.name ?? "",
  };
}

const sampleColumns = async (
  collection: Collection,
  sampled: boolean
): Promise<ColumnDetail[]> => {
  if (!sampled) {
    return [];
  }
  try {
    const documents = await collection
      .aggregate([{ $sample: { size: SAMPLE_SIZE } }], {
        maxTimeMS: SAMPLE_TIMEOUT_MS,
      })
      .toArray();
    return sampleFields(documents);
  } catch {
    return [];
  }
};

const describeCollection = async (
  name: string,
  collection: Collection,
  sampled: boolean
): Promise<TableItem> => {
  const [indexes, rowEstimate, columns] = await Promise.all([
    collection.indexes().catch(() => [] as MongoIndexLike[]),
    collection.estimatedDocumentCount().catch(() => null),
    sampleColumns(collection, sampled),
  ]);
  return {
    columns,
    foreignKeys: [],
    indexes: (indexes as MongoIndexLike[]).map(toIndexItem),
    name,
    rowEstimate,
  };
};

const mapConcurrent = async <T, R>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<R>
): Promise<R[]> => {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += limit) {
    const batch = items.slice(start, start + limit);
    results.push(...(await Promise.all(batch.map(work))));
  }
  return results;
};

export function mapMongoError(err: unknown): DbError {
  if (err instanceof DbError) {
    return err;
  }
  const e = err as {
    code?: number | string;
    codeName?: string;
    message?: string;
    name?: string;
  };
  const stringified = String(err);
  const message =
    (typeof e.message === "string" && e.message.length > 0 && e.message) ||
    (stringified !== "[object Object]" && stringified) ||
    e.name ||
    "MongoDB error";

  let code = "DB_ERROR";
  if (typeof e.codeName === "string" && e.codeName.length > 0) {
    code = e.codeName;
  } else if (e.code !== undefined && e.code !== null) {
    code = String(e.code);
  }
  return new DbError(code, message);
}

export class MongoPool implements Pool {
  readonly dialect = null;
  readonly supportsExplain = false;
  readonly kind = "mongodb" as const;
  #client: MongoClient | null;
  readonly #defaultDb: string;

  constructor(client: MongoClient, defaultDb: string) {
    this.#client = client;
    this.#defaultDb = defaultDb;
  }

  get client(): MongoClient | null {
    return this.#client;
  }

  get defaultDb(): string {
    return this.#defaultDb;
  }

  async fetchVersion(): Promise<string> {
    const client = this.#requireClient();
    try {
      const info = (await client
        .db(this.#defaultDb)
        .admin()
        .serverInfo()) as {
        version?: string;
      };
      const version = info.version ?? "";
      return version ? `Mongo ${version}` : "";
    } catch (error) {
      throw mapMongoError(error);
    }
  }

  async listDatabases(): Promise<string[]> {
    const client = this.#requireClient();
    try {
      const result = (await client
        .db(this.#defaultDb)
        .admin()
        .listDatabases({ nameOnly: true })) as {
        databases?: { name: string }[];
      };
      const names = result.databases?.map((d) => d.name) ?? [];
      return names.length > 0 ? names : [this.#defaultDb];
    } catch {
      return [this.#defaultDb];
    }
  }

  async fetchSchema(database: string): Promise<SchemaInfo> {
    const client = this.#requireClient();
    try {
      const db = client.db(database);
      const collections = (await db
        .listCollections({}, { nameOnly: false })
        .toArray()) as MongoCollectionInfoLike[];
      const visible = collections
        .filter((info) => !info.name.startsWith("system."))
        .toSorted((a, b) => a.name.localeCompare(b.name));
      const views: ViewItem[] = visible
        .filter((info) => info.type === "view")
        .map((info) => ({ columns: [], name: info.name }));
      const names = visible
        .filter((info) => info.type !== "view")
        .map((info) => info.name);
      const sampled = new Set(names.slice(0, MAX_SAMPLED_COLLECTIONS));
      const tables = await mapConcurrent(names, SAMPLE_CONCURRENCY, (name) =>
        describeCollection(name, db.collection(name), sampled.has(name))
      );
      return { schemas: [{ name: database, tables, views }] };
    } catch (error) {
      throw mapMongoError(error);
    }
  }

  execute(
    _sql: string,
    _maxRows: number,
    _schema: string | null,
    _signal: AbortSignal
  ): Promise<ExecuteResult> {
    return Promise.reject(
      DbError.unsupported(`${this.kind} does not support SQL execution`)
    );
  }

  explain(
    _sql: string,
    _analyze: boolean,
    _schema: string | null,
    _signal: AbortSignal
  ): Promise<ExplainResult> {
    return Promise.reject(
      DbError.unsupported(`${this.kind} does not support EXPLAIN`)
    );
  }

  async close(): Promise<void> {
    const client = this.#client;
    if (!client) {
      return;
    }
    this.#client = null;
    try {
      await client.close();
    } catch {
      // already closing
    }
  }

  #requireClient(): MongoClient {
    if (!this.#client) {
      throw POOL_CLOSED;
    }
    return this.#client;
  }
}

export function isMongoPool(pool: unknown): pool is MongoPool {
  return pool instanceof MongoPool;
}
