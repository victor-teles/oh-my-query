import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CancellationRegistry, raceWithCancel } from "./cancellation.ts";
import { DbError } from "./error.ts";

async function swallow(p: Promise<unknown>): Promise<void> {
  try {
    await p;
  } catch {
    // intentional: caller already asserts rejection separately
  }
}

function pendingUntilAborted(signal: AbortSignal): Promise<never> {
  const { promise, reject } = Promise.withResolvers<never>();
  if (signal.aborted) {
    reject(signal.reason);
  } else {
    signal.addEventListener(
      "abort",
      () => {
        reject(signal.reason);
      },
      { once: true }
    );
  }
  return promise;
}

describe("cancellationRegistry", () => {
  it("register returns a non-aborted controller", () => {
    const registry = new CancellationRegistry();
    const ctrl = registry.register("q1");
    expect(ctrl.signal.aborted).toBeFalsy();
  });

  it("re-registering same id aborts the prior controller with cancelled reason", () => {
    const registry = new CancellationRegistry();
    const first = registry.register("q1");
    const second = registry.register("q1");
    expect(first.signal.aborted).toBeTruthy();
    expect(first.signal.reason).toBeInstanceOf(DbError);
    expect((first.signal.reason as DbError).code).toBe("QUERY_CANCELLED");
    expect(second.signal.aborted).toBeFalsy();
  });

  it("cancel returns true and aborts the controller", () => {
    const registry = new CancellationRegistry();
    const ctrl = registry.register("q1");
    const result = registry.cancel("q1");
    expect(result).toBeTruthy();
    expect(ctrl.signal.aborted).toBeTruthy();
    expect((ctrl.signal.reason as DbError).code).toBe("QUERY_CANCELLED");
  });

  it("cancel returns false for unknown id", () => {
    const registry = new CancellationRegistry();
    expect(registry.cancel("missing")).toBeFalsy();
  });

  it("remove deletes without aborting; subsequent cancel returns false", () => {
    const registry = new CancellationRegistry();
    const ctrl = registry.register("q1");
    registry.remove("q1");
    expect(ctrl.signal.aborted).toBeFalsy();
    expect(registry.cancel("q1")).toBeFalsy();
  });
});

describe("raceWithCancel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with the work value when work completes first", async () => {
    const ctrl = new AbortController();
    const result = await raceWithCancel(() => Promise.resolve("ok"), {
      signal: ctrl.signal,
      timeoutMs: 1000,
    });
    expect(result).toBe("ok");
  });

  it("clears the timeout timer on success", async () => {
    const ctrl = new AbortController();
    await raceWithCancel(() => Promise.resolve("ok"), {
      signal: ctrl.signal,
      timeoutMs: 1000,
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects with QUERY_TIMEOUT when timer fires before work resolves", async () => {
    const ctrl = new AbortController();
    const promise = raceWithCancel(pendingUntilAborted, {
      signal: ctrl.signal,
      timeoutMs: 50,
    });
    const drained = swallow(promise);
    await vi.advanceTimersByTimeAsync(50);
    await drained;
    await expect(promise).rejects.toMatchObject({ code: "QUERY_TIMEOUT" });
  });

  it("rejects when external signal aborts mid-flight", async () => {
    const ctrl = new AbortController();
    const promise = raceWithCancel(pendingUntilAborted, {
      signal: ctrl.signal,
      timeoutMs: 10_000,
    });
    const reason = new DbError("USER_ABORT", "user");
    ctrl.abort(reason);
    await expect(promise).rejects.toMatchObject({ code: "USER_ABORT" });
  });

  it("rejects immediately when external signal is already aborted", async () => {
    const ctrl = new AbortController();
    const reason = new DbError("USER_ABORT", "user");
    ctrl.abort(reason);
    const promise = raceWithCancel(pendingUntilAborted, {
      signal: ctrl.signal,
      timeoutMs: 10_000,
    });
    await expect(promise).rejects.toMatchObject({ code: "USER_ABORT" });
  });
});
