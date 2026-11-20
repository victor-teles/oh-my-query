import type { RedisReadCommand } from "@oh-my-query/core/client";
import type { Redis } from "ioredis";

import { DbError } from "@oh-my-query/core";

export const SCAN_MAX_KEYS = 10_000;
export const SCAN_MAX_ITERATIONS = 50;
export const SCAN_COUNT = 500;
const PIPELINE_CHUNK = 500;

export const cancelled = (): DbError =>
  new DbError("QUERY_CANCELLED", "Query cancelled");

export const throwIfAborted = (signal: AbortSignal): void => {
  if (signal.aborted) {
    throw cancelled();
  }
};

const NUMERIC = /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

export const toCell = (reply: unknown): unknown => {
  if (reply === null || reply === undefined) {
    return null;
  }
  if (Buffer.isBuffer(reply)) {
    return toCell(reply.toString("utf8"));
  }
  if (typeof reply === "string" && NUMERIC.test(reply.trim())) {
    const number = Number(reply);
    const exact =
      Number.isFinite(number) && Math.abs(number) <= Number.MAX_SAFE_INTEGER;
    return exact ? number : reply;
  }
  if (Array.isArray(reply)) {
    return reply.map(toCell);
  }
  return reply;
};

interface ScannedKeys {
  keys: string[];
  isTruncated: boolean;
}

export const scanKeys = async (
  client: Redis,
  match: string,
  signal: AbortSignal,
  maxKeys = SCAN_MAX_KEYS
): Promise<ScannedKeys> => {
  const keys = new Set<string>();
  let cursor = "0";
  for (let iteration = 0; iteration < SCAN_MAX_ITERATIONS; iteration += 1) {
    throwIfAborted(signal);
    const [next, batch] = await client.scan(
      cursor,
      "MATCH",
      match,
      "COUNT",
      SCAN_COUNT
    );
    for (const key of batch) {
      keys.add(key);
    }
    cursor = next;
    if (cursor === "0" || keys.size >= maxKeys) {
      break;
    }
  }
  const all = [...keys];
  return {
    isTruncated: cursor !== "0" || all.length > maxKeys,
    keys: all.slice(0, maxKeys),
  };
};

export const pipelined = async (
  client: Redis,
  keys: readonly string[],
  command: (key: string) => RedisReadCommand,
  signal: AbortSignal
): Promise<unknown[]> => {
  const replies: unknown[] = [];
  for (let start = 0; start < keys.length; start += PIPELINE_CHUNK) {
    throwIfAborted(signal);
    const pipeline = client.pipeline();
    for (const key of keys.slice(start, start + PIPELINE_CHUNK)) {
      const [name, ...args] = command(key);
      pipeline.call(name, ...args);
    }
    const results = (await pipeline.exec()) ?? [];
    replies.push(...results.map(([error, value]) => (error ? null : value)));
  }
  return replies;
};

export const closeQuietly = async (client: Redis): Promise<void> => {
  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
};

export const openReadClient = async (
  base: Redis,
  db: number
): Promise<Redis> => {
  const client = base.duplicate({ db, lazyConnect: true });
  try {
    await client.connect();
    return client;
  } catch (error) {
    client.disconnect();
    throw error;
  }
};
