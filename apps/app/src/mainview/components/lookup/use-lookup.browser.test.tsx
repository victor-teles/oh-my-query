import { describe, expect, it } from "vitest";

import type { LookupEvent } from "@/lib/ipc";

import { emitIpcMessage, mockIpc } from "@/test/ipc-mock";
import { renderHook } from "@/test/render-hook";

import { useLookup } from "./use-lookup";

const VALUE = { kind: "integer", value: "42" } as const;

const emit = (lookupId: unknown, event: LookupEvent) =>
  emitIpcMessage("lookupEvent", { event, lookupId });

const setup = (onLookup: (lookupId: unknown) => unknown = () => null) => {
  const started: Record<string, unknown>[] = [];
  const cancelled: unknown[] = [];
  mockIpc({
    cancelLookup: (payload) => {
      cancelled.push(payload.lookupId);
      return null;
    },
    lookup: (payload) => {
      started.push(payload);
      return onLookup(payload.lookupId);
    },
  });
  return { cancelled, hook: renderHook(() => useLookup()), started };
};

const PLANNED: LookupEvent = {
  probes: 2,
  skipped: { largeUnindexed: 0, outOfRange: 0, overLimit: 0 },
  tables: 2,
  type: "planned",
};

describe("useLookup", () => {
  it("sends only the connection and the value, then follows its events", async () => {
    const { hook, started } = setup((lookupId) => {
      emit(lookupId, PLANNED);
      return null;
    });
    await hook.result.current.start(VALUE, "db");
    expect(started[0]).toMatchObject({
      connectionId: "db",
      database: null,
      value: VALUE,
    });
    await expect.poll(() => hook.result.current.state.status).toBe("probing");
  });

  it("ignores another lookup's events", async () => {
    const { hook } = setup();
    await hook.result.current.start(VALUE, "db");
    await expect.poll(() => hook.result.current.state.status).toBe("planning");
    emit("someone-else", PLANNED);
    await expect.poll(() => hook.result.current.state.status).toBe("planning");
  });

  it("cancels the previous lookup when a new one starts", async () => {
    const { cancelled, hook, started } = setup();
    await hook.result.current.start(VALUE, "db");
    await hook.result.current.start({ kind: "integer", value: "7" }, "db");
    expect(cancelled).toStrictEqual([started[0]?.lookupId]);
  });

  it("stops on cancel and stays local after the lookup ended", async () => {
    const { cancelled, hook, started } = setup();
    await hook.result.current.start(VALUE, "db");
    hook.result.current.cancel();
    await expect.poll(() => hook.result.current.state.status).toBe("cancelled");
    expect(cancelled).toHaveLength(1);

    await hook.result.current.start(VALUE, "db");
    emit(started[1]?.lookupId, {
      budgetExceeded: false,
      elapsedMs: 3,
      type: "done",
    });
    await expect.poll(() => hook.result.current.state.status).toBe("done");
    hook.result.current.cancel();
    expect(cancelled).toHaveLength(1);
  });

  it("reports a request that could not be sent", async () => {
    const { hook } = setup(() => {
      throw new Error("bun is gone");
    });
    await hook.result.current.start(VALUE, "db");
    await expect
      .poll(() => hook.result.current.state.error?.code)
      .toBe("FAILED");
  });

  it("cancels a running lookup when its owner unmounts", async () => {
    const { cancelled, hook } = setup();
    await hook.result.current.start(VALUE, "db");
    hook.unmount();
    expect(cancelled).toHaveLength(1);
  });
});
