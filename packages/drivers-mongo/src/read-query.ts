import type { TabularResult } from "@conch/core";
import type { Document } from "mongodb";

import { DbError } from "@conch/core";
import { flattenRecords, parseMongoReadQuery } from "@conch/core/client";
import { BSON } from "mongodb";

import type { MongoPool } from "./pool.ts";

import { mapMongoError } from "./pool.ts";

export const MONGO_QUERY_TIMEOUT_MS = 30_000;
export const MONGO_MAX_COLUMNS = 30;
const QUERY_COMMENT = "conch ask";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof BSON.BSONValue) &&
  !(value instanceof Date);

const safeNumber = (value: number, text: string): number | string =>
  Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER
    ? value
    : text;

const binaryText = (value: BSON.Binary): string =>
  value.sub_type === BSON.Binary.SUBTYPE_UUID
    ? value.toUUID().toHexString(true)
    : `<binary ${value.length()} bytes>`;

const bsonScalar = (value: BSON.BSONValue): unknown => {
  if (value instanceof BSON.ObjectId) {
    return value.toHexString();
  }
  if (value instanceof BSON.Decimal128) {
    const text = value.toString();
    return safeNumber(Number(text), text);
  }
  if (value instanceof BSON.Long && !(value instanceof BSON.Timestamp)) {
    return safeNumber(value.toNumber(), value.toString());
  }
  if (value instanceof BSON.Int32 || value instanceof BSON.Double) {
    const number = value.valueOf();
    return safeNumber(number, String(number));
  }
  if (value instanceof BSON.Binary) {
    return binaryText(value);
  }
  return String(value);
};

export const toPlainValue = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (value instanceof BSON.BSONValue) {
    return bsonScalar(value);
  }
  if (Array.isArray(value)) {
    return value.map(toPlainValue);
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, toPlainValue(nested)])
    );
  }
  return value;
};

const toPlainRecord = (document: Document): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(document).map(([key, value]) => [key, toPlainValue(value)])
  );

const notReadOnly = (reason: string): DbError =>
  new DbError("NOT_READ_ONLY", reason);

const deserializePipeline = (
  pipeline: readonly Record<string, unknown>[]
): Document[] => {
  const stages: unknown = BSON.EJSON.deserialize(
    { pipeline },
    { relaxed: false }
  ).pipeline;
  if (!(Array.isArray(stages) && stages.every(isPlainObject))) {
    throw new DbError("QUERY_FAILED", "The pipeline could not be read.");
  }
  return stages;
};

export async function runMongoReadQuery(
  pool: MongoPool,
  text: string,
  database: string,
  maxRows: number,
  signal: AbortSignal
): Promise<TabularResult> {
  const parsed = parseMongoReadQuery(text);
  if (!parsed.ok) {
    throw notReadOnly(parsed.reason);
  }
  const { client } = pool;
  if (!client) {
    throw new DbError("POOL_CLOSED", "MongoDB pool is closed");
  }
  const started = performance.now();
  try {
    const pipeline = deserializePipeline(parsed.query.pipeline);
    const documents = await client
      .db(database)
      .collection(parsed.query.collection)
      .aggregate([...pipeline, { $limit: maxRows + 1 }], {
        comment: QUERY_COMMENT,
        maxTimeMS: MONGO_QUERY_TIMEOUT_MS,
        signal,
      })
      .toArray();
    const result = flattenRecords(
      documents.slice(0, maxRows).map(toPlainRecord),
      {
        isTruncated: documents.length > maxRows,
        maxColumns: MONGO_MAX_COLUMNS,
      }
    );
    return {
      ...result,
      executionTimeMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    throw signal.aborted
      ? new DbError("QUERY_CANCELLED", "Query cancelled")
      : mapMongoError(error);
  }
}
