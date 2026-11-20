import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { WidgetRunResult } from "@/lib/ipc";

import { boardWidgets, makeTiles } from "@/test/board-fixtures";
import { mockIpc } from "@/test/ipc-mock";
import { renderHook } from "@/test/render-hook";
import { runResult } from "@/test/widget-fixtures";

import { MAX_CONCURRENT_RUNS, useBoardRefresh } from "./use-board-refresh";

const widgets = new Map(boardWidgets().map((widget) => [widget.id, widget]));

interface PendingRun {
  payload: Record<string, unknown>;
  resolve: (value: WidgetRunResult) => void;
}

const setupIpc = () => {
  const pending: PendingRun[] = [];
  const runWidget = vi.fn((payload: Record<string, unknown>) => {
    const { promise, resolve } = Promise.withResolvers<WidgetRunResult>();
    pending.push({ payload, resolve });
    return promise;
  });
  const cancelWidgetRun = vi.fn();
  mockIpc({ cancelWidgetRun, runWidget });
  return { cancelWidgetRun, pending, runWidget };
};

const visibility = { state: "visible" as DocumentVisibilityState };
const setVisibility = (state: DocumentVisibilityState) => {
  visibility.state = state;
  document.dispatchEvent(new Event("visibilitychange"));
};

const tiles5 = makeTiles([
  "w-revenue",
  "w-signups",
  "w-churn",
  "w-mrr",
  "w-orders",
]);

describe("useBoardRefresh", () => {
  beforeAll(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility.state,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    visibility.state = "visible";
  });

  it("runs at most four tiles at a time and starts the next as one finishes", async () => {
    const { pending, runWidget } = setupIpc();
    renderHook(() =>
      useBoardRefresh({
        refreshMs: null,
        sharedValues: {},
        tiles: tiles5,
        widgets,
      })
    );
    await expect
      .poll(() => runWidget.mock.calls.length)
      .toBe(MAX_CONCURRENT_RUNS);

    pending[0]?.resolve(runResult());
    await expect.poll(() => runWidget.mock.calls.length).toBe(5);
  });

  it("records outcomes per tile and the time of the last update", async () => {
    const { pending } = setupIpc();
    const { result } = renderHook(() =>
      useBoardRefresh({
        refreshMs: null,
        sharedValues: {},
        tiles: tiles5.slice(0, 1),
        widgets,
      })
    );
    await expect.poll(() => pending.length).toBe(1);
    pending[0]?.resolve(runResult());
    await expect.poll(() => result.current.runs.t1?.status).toBe("done");
    expect(result.current.updatedAt).not.toBeNull();
  });

  it("records a failure on the tile", async () => {
    mockIpc({
      cancelWidgetRun: vi.fn(),
      runWidget: () => {
        throw Object.assign(new Error("boom"), { code: "QUERY_FAILED" });
      },
    });
    const { result } = renderHook(() =>
      useBoardRefresh({
        refreshMs: null,
        sharedValues: {},
        tiles: tiles5.slice(0, 1),
        widgets,
      })
    );
    await expect
      .poll(() => result.current.runs.t1?.failure?.message)
      .toBe("boom");
  });

  it("cancels runs still in flight when the board closes", async () => {
    const { cancelWidgetRun, runWidget, pending } = setupIpc();
    const { unmount } = renderHook(() =>
      useBoardRefresh({
        refreshMs: null,
        sharedValues: {},
        tiles: tiles5.slice(0, 2),
        widgets,
      })
    );
    await expect.poll(() => pending.length).toBe(2);
    unmount();
    expect(cancelWidgetRun).toHaveBeenCalledTimes(2);
    expect(runWidget).toHaveBeenCalledTimes(2);
  });

  it("cancels a tile's run when it refreshes again", async () => {
    const { cancelWidgetRun, pending } = setupIpc();
    const { result } = renderHook(() =>
      useBoardRefresh({
        refreshMs: null,
        sharedValues: {},
        tiles: tiles5.slice(0, 1),
        widgets,
      })
    );
    await expect.poll(() => pending.length).toBe(1);
    result.current.refresh(["t1"]);
    await expect.poll(() => pending.length).toBe(2);
    expect(cancelWidgetRun).toHaveBeenCalledWith({
      runId: pending[0]?.payload.runId,
    });
  });

  it("refreshes with new shared values for the matching inputs", async () => {
    const { pending, runWidget } = setupIpc();
    const { result } = renderHook(() =>
      useBoardRefresh({
        refreshMs: null,
        sharedValues: {},
        tiles: tiles5.slice(0, 2),
        widgets,
      })
    );
    await expect.poll(() => pending.length).toBe(2);
    for (const run of pending) {
      run.resolve(runResult());
    }
    result.current.refresh(["t1", "t2"], { "period:dateRange": "ytd" });
    await expect.poll(() => runWidget.mock.calls.length).toBe(4);
    expect(
      runWidget.mock.calls.slice(2).map(([payload]) => payload.values)
    ).toStrictEqual([{ period: "ytd", region: "Europe" }, { period: "ytd" }]);
  });

  it("refreshes on the interval only while the board is visible", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const { pending, runWidget } = setupIpc();
    renderHook(() =>
      useBoardRefresh({
        refreshMs: 60_000,
        sharedValues: {},
        tiles: tiles5.slice(0, 1),
        widgets,
      })
    );
    await expect.poll(() => pending.length).toBe(1);
    pending[0]?.resolve(runResult());

    setVisibility("hidden");
    vi.advanceTimersByTime(180_000);
    expect(runWidget).toHaveBeenCalledOnce();

    setVisibility("visible");
    await expect.poll(() => runWidget.mock.calls.length).toBe(2);
    vi.advanceTimersByTime(60_000);
    await expect.poll(() => runWidget.mock.calls.length).toBe(3);
  });
});
