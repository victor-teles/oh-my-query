import type Redis from "ioredis";

import { vi } from "vitest";

import { RedisPool } from "./pool.ts";

export type Reply = (name: string, args: string[]) => unknown;

export const replyTable =
  (table: Record<string, unknown>): Reply =>
  (name, args) =>
    table[[name, ...args].join(" ")] ?? table[name] ?? null;

interface FakeRedisOptions {
  reply?: Reply;
  keys?: string[];
  pageSize?: number;
  endless?: boolean;
}

const globToRegExp = (glob: string): RegExp =>
  new RegExp(
    `^${glob
      .replaceAll(/[.+^${}()|[\]\\]/g, String.raw`\$&`)
      .replaceAll("*", ".*")
      .replaceAll("?", ".")}$`
  );

export const fakeRedis = ({
  reply = () => null,
  keys = [],
  pageSize = 500,
  endless = false,
}: FakeRedisOptions = {}) => {
  const call = vi.fn(async (name: string, ...args: (string | number)[]) => {
    await Promise.resolve();
    return reply(name.toUpperCase(), args.map(String));
  });
  const scan = vi.fn(
    (
      cursor: string,
      _match: string,
      pattern: string,
      _count: string,
      _n: number
    ) => {
      const matching = keys.filter((key) => globToRegExp(pattern).test(key));
      const start = Number(cursor);
      const page = matching.slice(start, start + pageSize);
      const next = start + pageSize;
      const done = !endless && next >= matching.length;
      return Promise.resolve([done ? "0" : String(next), page]);
    }
  );
  const pipeline = vi.fn(() => {
    const queued: string[][] = [];
    const chain = {
      call: (name: string, ...args: (string | number)[]) => {
        queued.push([name.toUpperCase(), ...args.map(String)]);
        return chain;
      },
      exec: async () => {
        await Promise.resolve();
        return queued.map(([name = "", ...args]) => [null, reply(name, args)]);
      },
    };
    return chain;
  });
  const quit = vi.fn<() => Promise<string>>().mockResolvedValue("OK");
  const disconnect = vi.fn();
  const dbsize = vi.fn<() => Promise<number>>().mockResolvedValue(keys.length);
  const connect = vi.fn<() => Promise<void>>().mockResolvedValue();
  const connection = {
    call,
    connect,
    dbsize,
    disconnect,
    pipeline,
    quit,
    scan,
  };
  const duplicate = vi.fn(
    (_options: { db: number; lazyConnect: boolean }) => connection
  );
  const select = vi.fn();
  const pool = new RedisPool({ duplicate, select } as unknown as Redis, 0);
  return { ...connection, duplicate, pool, select };
};
