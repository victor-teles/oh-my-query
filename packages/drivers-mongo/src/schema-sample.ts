import type { ColumnDetail } from "@conch/core";
import type { Document } from "mongodb";

import { BSON } from "mongodb";

export const SAMPLE_SIZE = 50;
export const SAMPLE_TIMEOUT_MS = 2000;
export const MAX_SAMPLED_FIELDS = 40;

const BSON_TYPE_NAMES: Record<string, string> = {
  Binary: "binary",
  Decimal128: "number",
  Double: "number",
  Int32: "number",
  Long: "number",
  ObjectId: "objectId",
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof BSON.BSONValue) &&
  !(value instanceof Date);

const scalarTypeName = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "null";
  }
  if (value instanceof Date) {
    return "date";
  }
  if (value instanceof BSON.BSONValue) {
    const bsonType = value._bsontype;
    return BSON_TYPE_NAMES[bsonType] ?? bsonType.toLowerCase();
  }
  if (typeof value === "boolean") {
    return "bool";
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return "number";
  }
  return isPlainObject(value) ? "object" : typeof value;
};

const dominant = (counts: ReadonlyMap<string, number>): string => {
  let best = "null";
  let bestCount = 0;
  for (const [name, count] of counts) {
    if (name !== "null" && count > bestCount) {
      best = name;
      bestCount = count;
    }
  }
  return best;
};

export const bsonTypeName = (value: unknown): string => {
  if (!Array.isArray(value)) {
    return scalarTypeName(value);
  }
  const counts = new Map<string, number>();
  for (const item of value) {
    const name = scalarTypeName(item);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts.size === 0 ? "array" : `array<${dominant(counts)}>`;
};

interface FieldStats {
  types: Map<string, number>;
  seen: number;
}

const nestedObjects = (value: unknown): Record<string, unknown>[] => {
  if (isPlainObject(value)) {
    return [value];
  }
  return Array.isArray(value) ? value.filter(isPlainObject) : [];
};

export const sampleFields = (
  documents: readonly Document[]
): ColumnDetail[] => {
  const fields = new Map<string, FieldStats>();
  const record = (path: string, value: unknown) => {
    const stats = fields.get(path) ?? { seen: 0, types: new Map() };
    const name = bsonTypeName(value);
    stats.types.set(name, (stats.types.get(name) ?? 0) + 1);
    stats.seen += 1;
    fields.set(path, stats);
  };
  for (const document of documents) {
    for (const [key, value] of Object.entries(document)) {
      record(key, value);
      for (const nested of nestedObjects(value)) {
        for (const [nestedKey, nestedValue] of Object.entries(nested)) {
          record(`${key}.${nestedKey}`, nestedValue);
        }
      }
    }
  }
  return [...fields].slice(0, MAX_SAMPLED_FIELDS).map(([name, stats]) => ({
    dataType: dominant(stats.types),
    defaultValue: null,
    isNullable: stats.seen < documents.length || stats.types.has("null"),
    isPrimaryKey: name === "_id",
    name,
  }));
};
