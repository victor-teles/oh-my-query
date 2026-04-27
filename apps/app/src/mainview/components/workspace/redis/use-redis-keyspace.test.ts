import { describe, expect, it } from "vitest";

import {
  initialKeyspaceState,
  keyspaceReducer,
  LARGE_KEYSPACE_THRESHOLD,
} from "./use-redis-keyspace";

describe("keyspace reducer", () => {
  it("starts in db-loading so the panel never renders an idle body", () => {
    expect(initialKeyspaceState.status).toBe("db-loading");
  });

  it("empty DB takes empty-db over gated", () => {
    const next = keyspaceReducer(initialKeyspaceState, {
      payload: { memoryBytes: null, totalKeys: 0 },
      type: "db-loaded",
    });
    expect(next.status).toBe("empty-db");
  });

  it("gates when totalKeys >= threshold with no pattern", () => {
    const next = keyspaceReducer(initialKeyspaceState, {
      payload: { memoryBytes: null, totalKeys: LARGE_KEYSPACE_THRESHOLD + 1 },
      type: "db-loaded",
    });
    expect(next.status).toBe("gated");
  });

  it("skips the gate once scanAllOverride is set", () => {
    const overridden = keyspaceReducer(initialKeyspaceState, {
      type: "override-gate",
    });
    expect(overridden.scanAllOverride).toBeTruthy();
    expect(overridden.status).toBe("scanning");

    const afterDbInfo = keyspaceReducer(overridden, {
      payload: { memoryBytes: null, totalKeys: 50_000 },
      type: "db-loaded",
    });
    expect(afterDbInfo.status).toBe("scanning");
  });

  it("transitions from gated to scanning when a pattern is typed", () => {
    const gated = keyspaceReducer(initialKeyspaceState, {
      payload: { memoryBytes: null, totalKeys: 10_000 },
      type: "db-loaded",
    });
    expect(gated.status).toBe("gated");

    const withPattern = keyspaceReducer(gated, {
      payload: "user:*",
      type: "set-pattern",
    });
    expect(withPattern.status).toBe("scanning");
    expect(withPattern.pattern).toBe("user:*");
  });

  it("scan-start fresh clears keys; scan-start paging keeps them", () => {
    const loaded = keyspaceReducer(initialKeyspaceState, {
      payload: {
        fresh: true,
        keys: [
          {
            kind: "STRING",
            name: "a",
            size: 1,
            sizeUnit: "bytes",
            ttlSecs: null,
          },
        ],
        nextCursor: "42",
        sampled: 1,
      },
      type: "scan-page",
    });
    expect(loaded.keys).toHaveLength(1);

    const fresh = keyspaceReducer(loaded, {
      payload: { fresh: true },
      type: "scan-start",
    });
    expect(fresh.keys).toHaveLength(0);

    const paging = keyspaceReducer(loaded, {
      payload: { fresh: false },
      type: "scan-start",
    });
    expect(paging.keys).toHaveLength(1);
  });

  it("remove-key drops the key in place without touching cursor", () => {
    const loaded = keyspaceReducer(initialKeyspaceState, {
      payload: {
        fresh: true,
        keys: [
          {
            kind: "STRING",
            name: "a",
            size: 1,
            sizeUnit: "bytes",
            ttlSecs: null,
          },
          {
            kind: "HASH",
            name: "b",
            size: 3,
            sizeUnit: "fields",
            ttlSecs: null,
          },
        ],
        nextCursor: "12",
        sampled: 2,
      },
      type: "scan-page",
    });

    const afterDelete = keyspaceReducer(loaded, {
      payload: "a",
      type: "remove-key",
    });
    expect(afterDelete.keys.map((k) => k.name)).toStrictEqual(["b"]);
    expect(afterDelete.nextCursor).toBe("12");
  });

  it("resets fully on the reset action", () => {
    const loaded = keyspaceReducer(initialKeyspaceState, {
      payload: {
        fresh: true,
        keys: [
          {
            kind: "STRING",
            name: "a",
            size: 1,
            sizeUnit: "bytes",
            ttlSecs: null,
          },
        ],
        nextCursor: "42",
        sampled: 1,
      },
      type: "scan-page",
    });
    const reset = keyspaceReducer(loaded, { type: "reset" });
    expect(reset).toStrictEqual(initialKeyspaceState);
  });
});
