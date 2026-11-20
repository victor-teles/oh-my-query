import type { TabularResult } from "@oh-my-query/core";
import type { RedisReadCommand, RedisReadPlan } from "@oh-my-query/core/client";
import type { Redis } from "ioredis";

import { DbError } from "@oh-my-query/core";
import {
  flattenRecords,
  parseRedisReadPlan,
  redisCommandShape,
} from "@oh-my-query/core/client";

import type { RedisPool } from "./pool.ts";

import { generalizeKey } from "./key-patterns.ts";
import { mapRedisError, parseDbIndex } from "./pool.ts";
import {
  cancelled,
  closeQuietly,
  openReadClient,
  pipelined,
  scanKeys,
  throwIfAborted,
  toCell,
} from "./scan.ts";

export const MEASURE_MAX_KEYS = 2000;
const MAX_COLUMNS = 30;

type Row = Record<string, unknown>;
type ScanPlan = Extract<RedisReadPlan, { kind: "scan" }>;

interface Rows {
  records: Row[];
  isTruncated: boolean;
}

const asList = (reply: unknown): unknown[] =>
  Array.isArray(reply) ? reply : [reply];

const pairs = (reply: unknown, first: string, second: string): Row[] => {
  const items = asList(reply);
  const rows: Row[] = [];
  for (let index = 0; index + 1 < items.length; index += 2) {
    rows.push({
      [first]: toCell(items[index]),
      [second]: toCell(items[index + 1]),
    });
  }
  return rows;
};

const singles = (reply: unknown, column: string): Row[] =>
  reply === null
    ? []
    : asList(reply).map((item) => ({ [column]: toCell(item) }));

const hasOption = (args: readonly string[], option: string): boolean =>
  args.some((arg) => arg.toUpperCase() === option);

const streamRows = (reply: unknown): Row[] =>
  asList(reply).flatMap((entry) => {
    if (!Array.isArray(entry)) {
      return [];
    }
    const [id, fields] = entry;
    const values = pairs(fields, "field", "value");
    return [
      {
        id: toCell(id),
        ...Object.fromEntries(
          values.map((pair) => [String(pair.field), pair.value])
        ),
      },
    ];
  });

const collectionRows = (
  [name, ...args]: RedisReadCommand,
  reply: unknown
): Row[] => {
  switch (name) {
    case "HGETALL": {
      return pairs(reply, "field", "value");
    }
    case "HKEYS": {
      return singles(reply, "field");
    }
    case "HVALS":
    case "LRANGE": {
      return singles(reply, "value");
    }
    case "HRANDFIELD": {
      return hasOption(args, "WITHVALUES")
        ? pairs(reply, "field", "value")
        : singles(reply, "field");
    }
    case "XRANGE":
    case "XREVRANGE": {
      return streamRows(reply);
    }
    default: {
      return hasOption(args, "WITHSCORES")
        ? pairs(reply, "member", "score")
        : singles(reply, "member");
    }
  }
};

export const parseInfo = (reply: unknown): Row[] =>
  String(reply ?? "")
    .split(/\r?\n/)
    .flatMap((line) => {
      const at = line.indexOf(":");
      if (line.startsWith("#") || at <= 0) {
        return [];
      }
      return [{ field: line.slice(0, at), value: toCell(line.slice(at + 1)) }];
    });

const keyedRows = (
  [name, ...args]: RedisReadCommand,
  reply: unknown
): Row[] => {
  const replies = asList(reply);
  if (name === "MGET") {
    return args.map((key, index) => ({ key, value: toCell(replies[index]) }));
  }
  const [hash = "", ...fields] = args;
  return fields.map((field, index) => ({
    field,
    key: hash,
    value: toCell(replies[index]),
  }));
};

const scalarRows = (command: RedisReadCommand, reply: unknown): Row[] => {
  const [name, ...args] = command;
  if (name === "INFO") {
    return parseInfo(reply);
  }
  if (redisCommandShape(name) === "keyed") {
    return keyedRows(command, reply);
  }
  const key = name === "MEMORY" ? args[1] : args[0];
  return [{ command: name, key: key ?? null, value: toCell(reply) }];
};

const runCommands = async (
  client: Redis,
  commands: readonly RedisReadCommand[],
  signal: AbortSignal
): Promise<Row[]> => {
  const [only] = commands;
  if (
    only &&
    commands.length === 1 &&
    redisCommandShape(only[0]) === "collection"
  ) {
    const [name, ...args] = only;
    return collectionRows(only, await client.call(name, ...args));
  }
  const rows: Row[] = [];
  for (const command of commands) {
    throwIfAborted(signal);
    const [name, ...args] = command;
    const result = scalarRows(command, await client.call(name, ...args));
    rows.push(
      ...(commands.length > 1
        ? result.map((row) => ({ command: name, ...row }))
        : result)
    );
  }
  return rows;
};

const groupKeys = async (
  client: Redis,
  plan: ScanPlan,
  keys: readonly string[],
  signal: AbortSignal
): Promise<string[]> => {
  if (plan.groupBy === "pattern") {
    return keys.map(generalizeKey);
  }
  if (plan.groupBy === "none") {
    return keys.map(() => plan.match);
  }
  const types = await pipelined(client, keys, (key) => ["TYPE", key], signal);
  return types.map((type) => String(type ?? "unknown"));
};

const MEASURE_COLUMNS = {
  memory: "memory_bytes",
  ttl: "avg_ttl_secs",
} as const;

const measureKeys = (
  client: Redis,
  plan: ScanPlan,
  keys: readonly string[],
  signal: AbortSignal
): Promise<unknown[]> =>
  plan.measure === "memory"
    ? pipelined(client, keys, (key) => ["MEMORY", "USAGE", key], signal)
    : pipelined(client, keys, (key) => ["PTTL", key], signal);

interface Group {
  keys: number;
  measured: number[];
}

const groupRow = (
  name: string,
  group: Group,
  measure: ScanPlan["measure"]
): Row => {
  if (measure === "count") {
    return { group: name, keys: group.keys };
  }
  const total = group.measured.reduce((sum, value) => sum + value, 0);
  const average =
    group.measured.length > 0 ? total / group.measured.length : null;
  if (measure === "memory") {
    return {
      group: name,
      keys: group.keys,
      [MEASURE_COLUMNS.memory]:
        average === null ? null : Math.round(average * group.keys),
    };
  }
  return {
    group: name,
    keys: group.keys,
    [MEASURE_COLUMNS.ttl]: average === null ? null : Math.round(average / 1000),
  };
};

const measuredValue = (
  measure: ScanPlan["measure"],
  reply: unknown
): number | null => {
  const value = toCell(reply);
  if (typeof value !== "number") {
    return null;
  }
  return measure === "ttl" && value < 0 ? null : value;
};

const sortKey = (row: Row, measure: ScanPlan["measure"]): number => {
  const value = measure === "count" ? row.keys : row[MEASURE_COLUMNS[measure]];
  return typeof value === "number" ? value : -1;
};

const runScan = async (
  client: Redis,
  plan: ScanPlan,
  signal: AbortSignal
): Promise<Rows> => {
  const scanned = await scanKeys(client, plan.match, signal);
  const groups = await groupKeys(client, plan, scanned.keys, signal);
  const measuredKeys =
    plan.measure === "count" ? [] : scanned.keys.slice(0, MEASURE_MAX_KEYS);
  const measures = await measureKeys(client, plan, measuredKeys, signal);
  const byGroup = new Map<string, Group>();
  for (const [index, name] of groups.entries()) {
    const group = byGroup.get(name) ?? { keys: 0, measured: [] };
    group.keys += 1;
    const value =
      index < measures.length
        ? measuredValue(plan.measure, measures[index])
        : null;
    if (value !== null) {
      group.measured.push(value);
    }
    byGroup.set(name, group);
  }
  const records = [...byGroup]
    .map(([name, group]) => groupRow(name, group, plan.measure))
    .toSorted(
      (a, b) =>
        sortKey(b, plan.measure) - sortKey(a, plan.measure) ||
        Number(b.keys) - Number(a.keys)
    )
    .slice(0, plan.limit);
  const sampled = measuredKeys.length < scanned.keys.length;
  return {
    isTruncated: scanned.isTruncated || (plan.measure !== "count" && sampled),
    records,
  };
};

const runPlan = async (
  client: Redis,
  plan: RedisReadPlan,
  signal: AbortSignal
): Promise<Rows> =>
  plan.kind === "scan"
    ? runScan(client, plan, signal)
    : {
        isTruncated: false,
        records: await runCommands(client, plan.commands, signal),
      };

export async function runRedisReadPlan(
  pool: RedisPool,
  text: string,
  database: string,
  maxRows: number,
  signal: AbortSignal
): Promise<TabularResult> {
  const parsed = parseRedisReadPlan(text);
  if (!parsed.ok) {
    throw new DbError("NOT_READ_ONLY", parsed.reason);
  }
  throwIfAborted(signal);
  const base = pool.client;
  if (!base) {
    throw new DbError("POOL_CLOSED", "Redis pool is closed");
  }
  const started = performance.now();
  const client = await openReadClient(base, parseDbIndex(database)).catch(
    (error: unknown) => {
      throw mapRedisError(error);
    }
  );
  const abort = () => client.disconnect();
  signal.addEventListener("abort", abort, { once: true });
  try {
    const { records, isTruncated } = await runPlan(client, parsed.plan, signal);
    const result = flattenRecords(records.slice(0, maxRows), {
      isTruncated: isTruncated || records.length > maxRows,
      maxColumns: MAX_COLUMNS,
    });
    return {
      ...result,
      executionTimeMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    throw signal.aborted ? cancelled() : mapRedisError(error);
  } finally {
    signal.removeEventListener("abort", abort);
    await closeQuietly(client);
  }
}
