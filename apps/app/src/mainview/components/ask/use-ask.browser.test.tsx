import { describe, expect, it } from "vitest";

import type { AskEvent } from "@/lib/ipc";

import { emitIpcMessage, mockIpc } from "@/test/ipc-mock";
import { renderHook, waitFor } from "@/test/render-hook";

import { useAsk } from "./use-ask";

const TARGET = { connectionId: "c1", database: null };

const emit = (askId: unknown, event: AskEvent) =>
  emitIpcMessage("askEvent", { askId, event });

const setup = (onAsk: (askId: unknown) => unknown = () => null) => {
  const asked: unknown[] = [];
  const cancelled: unknown[] = [];
  mockIpc({
    ask: (payload) => {
      asked.push(payload.askId);
      return onAsk(payload.askId);
    },
    cancelAsk: (payload) => {
      cancelled.push(payload.askId);
      return null;
    },
  });
  return { asked, cancelled, hook: renderHook(() => useAsk()) };
};

describe("useAsk", () => {
  it("subscribes before asking, so events sent during the request arrive", async () => {
    const { hook } = setup((askId) => {
      emit(askId, {
        detail: "Reading the analytics schema",
        phase: "schema",
        type: "phase",
      });
      return null;
    });
    await hook.result.current.start("Revenue by region", TARGET);
    await expect
      .poll(() => hook.result.current.state.schemaDetail)
      .toBe("Reading the analytics schema");
  });

  it("cancels the previous ask when a new question starts", async () => {
    const { asked, cancelled, hook } = setup();
    await hook.result.current.start("first", TARGET);
    await hook.result.current.start("second", TARGET);

    expect(cancelled).toStrictEqual([asked[0]]);
    emit(asked[0], { type: "done" });
    emit(asked[1], { detail: "Writing SQL", phase: "sql", type: "phase" });
    await expect.poll(() => hook.result.current.state.status).toBe("sql");
    expect(hook.result.current.state.prompt).toBe("second");
  });

  it("stops listening once the ask ends, so a later cancel stays local", async () => {
    const { asked, cancelled, hook } = setup();
    await hook.result.current.start("q", TARGET);
    emit(asked[0], { type: "done" });
    await expect.poll(() => hook.result.current.state.status).toBe("done");

    hook.result.current.cancel();
    expect(cancelled).toStrictEqual([]);
  });

  it("cancels an ask in flight and marks it stopped", async () => {
    const { asked, cancelled, hook } = setup();
    await hook.result.current.start("q", TARGET);
    hook.result.current.cancel();

    expect(cancelled).toStrictEqual([asked[0]]);
    await expect.poll(() => hook.result.current.state.status).toBe("cancelled");
  });

  it("cancels on bun and unsubscribes when unmounted mid-ask", async () => {
    const { asked, cancelled, hook } = setup();
    await hook.result.current.start("q", TARGET);
    hook.unmount();

    expect(cancelled).toStrictEqual([asked[0]]);
    expect(() => emit(asked[0], { type: "done" })).not.toThrow();
  });

  it("turns a rejected request into a QUERY_FAILED error", async () => {
    const { hook } = setup(() => {
      throw new Error("bad request");
    });
    await hook.result.current.start("q", TARGET);
    await expect
      .poll(() => hook.result.current.state.failure)
      .toStrictEqual({
        code: "QUERY_FAILED",
        message: "bad request",
        phase: "schema",
      });
  });

  it("exposes view selection and the SQL toggle", async () => {
    const { asked, hook } = setup();
    await hook.result.current.start("q", TARGET);
    emit(asked[0], { text: "select 1", type: "sqlDelta" });
    await expect.poll(() => hook.result.current.state.sql).toBe("select 1");

    hook.result.current.toggleSql();
    await expect.poll(() => hook.result.current.state.sqlExpanded).toBeFalsy();
    hook.result.current.selectView("table");
    expect(hook.result.current.state.view).toBeNull();
  });

  it.each([
    ["postgresql", 1],
    ["mongodb", 0],
    ["redis", 0],
  ] as const)(
    "describes %s answers with polyglot %i times",
    async (dialect, calls) => {
      const described: unknown[] = [];
      const asked: unknown[] = [];
      mockIpc({
        ask: (payload) => {
          asked.push(payload.askId);
          return null;
        },
        describeSql: (payload) => {
          described.push(payload);
          return null;
        },
      });
      const hook = renderHook(() => useAsk());
      await hook.result.current.start("q", TARGET);
      emit(asked[0], { dialect, lines: 1, sql: "q", type: "sqlDone" });
      await expect.poll(() => hook.result.current.state.dialect).toBe(dialect);
      await Promise.resolve();
      expect(described).toHaveLength(calls);
    }
  );

  it("ignores events for other asks", async () => {
    const { hook } = setup();
    await hook.result.current.start("q", TARGET);
    await expect.poll(() => hook.result.current.state.status).toBe("schema");
    const before = hook.result.current.state;

    emit("someone-else", { detail: "x", phase: "run", type: "phase" });
    expect(hook.result.current.state).toBe(before);
  });

  it("runs raw SQL through runSql, never ask", async () => {
    const runs: unknown[] = [];
    const asked: unknown[] = [];
    mockIpc({
      ask: (payload) => {
        asked.push(payload);
        return null;
      },
      cancelAsk: () => null,
      runSql: (payload) => {
        runs.push(payload);
        return null;
      },
    });
    const hook = renderHook(() => useAsk());
    await hook.result.current.startSql("select 1", TARGET, "One");
    expect(asked).toStrictEqual([]);
    expect(runs).toMatchObject([
      { ...TARGET, source: { kind: "sql", sql: "select 1", title: "One" } },
    ]);
    await waitFor(() => {
      expect(hook.result.current.state).toMatchObject({
        source: "sql",
        status: "run",
      });
    });
  });

  it("reports a raw run that could not be sent", async () => {
    mockIpc({
      cancelAsk: () => null,
      runSql: () => {
        throw new Error("Not connected.");
      },
    });
    const hook = renderHook(() => useAsk());
    await hook.result.current.startSql("select 1", TARGET);
    await waitFor(() => {
      expect(hook.result.current.state).toMatchObject({
        failure: {
          code: "QUERY_FAILED",
          message: "Not connected.",
          phase: "run",
        },
        status: "error",
      });
    });
  });
});
