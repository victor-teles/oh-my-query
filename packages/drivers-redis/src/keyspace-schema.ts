import type { ColumnDetail, TableItem } from "@oh-my-query/core";
import type { Redis } from "ioredis";

import { groupKeyPatterns } from "./key-patterns.ts";
import { pipelined, scanKeys } from "./scan.ts";

export const SCHEMA_SAMPLE_KEYS = 2000;
export const MAX_PATTERNS = 60;
export const MAX_HASH_FIELDS = 30;

const column = (name: string, dataType: string): ColumnDetail => ({
  dataType,
  defaultValue: null,
  isNullable: true,
  isPrimaryKey: false,
  name,
});

const fieldNames = (reply: unknown): string[] =>
  Array.isArray(reply) ? reply.slice(0, MAX_HASH_FIELDS).map(String) : [];

export const sampleKeyspace = async (client: Redis): Promise<TableItem[]> => {
  const { signal } = new AbortController();
  const { keys } = await scanKeys(client, "*", signal, SCHEMA_SAMPLE_KEYS);
  if (keys.length === 0) {
    return [];
  }
  const patterns = groupKeyPatterns(keys).slice(0, MAX_PATTERNS);
  const samples = patterns.map((pattern) => pattern.sample);
  const [total, types] = await Promise.all([
    client.dbsize(),
    pipelined(client, samples, (key) => ["TYPE", key], signal),
  ]);
  const hashSamples = samples.filter((_, index) => types[index] === "hash");
  const hashFields = await pipelined(
    client,
    hashSamples,
    (key) => ["HKEYS", key],
    signal
  );
  const fieldsBySample = new Map(
    hashSamples.map((sample, index) => [sample, fieldNames(hashFields[index])])
  );
  const scale = total / keys.length;
  return patterns.map((pattern, index) => {
    const type = String(types[index] ?? "none");
    const fields = fieldsBySample.get(pattern.sample);
    return {
      columns: fields
        ? fields.map((field) => column(field, "string"))
        : [column("value", type)],
      foreignKeys: [],
      indexes: [],
      name: pattern.pattern,
      rowEstimate: Math.round(pattern.count * scale),
    };
  });
};
