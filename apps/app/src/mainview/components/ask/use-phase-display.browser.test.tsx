import { CARD_SPEC_VERSION } from "@oh-my-query/rpc";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderHook } from "@/test/render-hook";

import type { AskState } from "./ask-reducer";

import { initialAskState } from "./ask-reducer";
import { usePhaseDisplay } from "./use-phase-display";

const SPEC = {
  formats: {},
  title: "t",
  version: CARD_SPEC_VERSION,
  view: { kind: "table" as const },
};
const ANSWER = {
  result: {
    columns: [],
    executionTimeMs: 1,
    isTruncated: false,
    rowCount: 0,
    rows: [],
  },
  spec: SPEC,
};

const working: AskState = { ...initialAskState, status: "sql" };
const answered: AskState = {
  ...initialAskState,
  answer: ANSWER,
  position: 0,
  status: "done",
  turns: [
    {
      answer: ANSWER,
      assumptions: null,
      dialect: "postgresql",
      prompt: "q",
      sql: "select 1",
      view: "table",
    },
  ],
};

// React flushes on a MessageChannel task, which fake timers do not drive.
const advance = async (ms: number) => {
  await vi.advanceTimersByTimeAsync(ms);
  const { promise, resolve } = Promise.withResolvers<void>();
  const channel = new MessageChannel();
  channel.port1.addEventListener("message", () => resolve(), { once: true });
  channel.port1.start();
  channel.port2.postMessage(null);
  await promise;
};

const renderDisplay = (state: AskState) =>
  renderHook((props: AskState) => usePhaseDisplay(props), {
    initialProps: state,
  });

describe("usePhaseDisplay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("goes straight to the card when the answer lands within 150ms", async () => {
    const { result, rerender } = renderDisplay(working);
    expect(result.current).toBe("empty");
    await advance(100);
    rerender(answered);
    await advance(500);
    expect(result.current).toBe("card");
  });

  it("shows the working state after 150ms and holds it for 300ms", async () => {
    const { result, rerender } = renderDisplay(working);
    await advance(151);
    expect(result.current).toBe("working");

    rerender(answered);
    await advance(200);
    expect(result.current).toBe("working");
    await advance(150);
    expect(result.current).toBe("card");
  });

  it.each<[AskState["status"], string]>([
    ["error", "error"],
    ["cancelled", "stopped"],
    ["idle", "empty"],
  ])("maps a settled %s ask to %s", (status, body) => {
    const { result } = renderDisplay({ ...initialAskState, status });
    expect(result.current).toBe(body);
  });
});
