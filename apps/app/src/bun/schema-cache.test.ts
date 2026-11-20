import type { ConnectionPoolManager } from "@conch/drivers";

import { describe, expect, it, vi } from "vitest";

import { createSchemaCache } from "./schema-cache.ts";

const setup = () => {
  const fetchSchema = vi.fn().mockResolvedValue({ schemas: [] });
  const pools = {
    getPool: vi.fn(() => ({ fetchSchema })),
  } as unknown as ConnectionPoolManager;
  return { cache: createSchemaCache(pools), fetchSchema };
};

describe("createSchemaCache", () => {
  it("serves repeat reads from the cache", async () => {
    const { cache, fetchSchema } = setup();
    await cache.get("c1", "public");
    await cache.get("c1", "public");
    expect(fetchSchema).toHaveBeenCalledOnce();
  });

  it("refetches when forced or invalidated", async () => {
    const { cache, fetchSchema } = setup();
    await cache.get("c1", "public");
    await cache.get("c1", "public", true);
    cache.invalidate("c1");
    await cache.get("c1", "public");
    expect(fetchSchema).toHaveBeenCalledTimes(3);
  });

  it("expires entries after a minute", async () => {
    vi.useFakeTimers();
    const { cache, fetchSchema } = setup();
    await cache.get("c1", "public");
    vi.advanceTimersByTime(60_001);
    await cache.get("c1", "public");
    expect(fetchSchema).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
