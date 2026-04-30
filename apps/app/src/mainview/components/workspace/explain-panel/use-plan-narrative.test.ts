import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ExplainResult, PlanNode } from "@/lib/tauri";

const makeNode = (overrides: Partial<PlanNode> = {}): PlanNode => ({
  children: [],
  cost: { actualTotalMs: 10, selfMs: 10, startup: null, total: null },
  details: [],
  id: "root",
  label: "Seq Scan on users",
  nodeType: "Seq Scan",
  rows: { actual: null, estimated: null },
  timing: { actualTotalMs: null, loops: null, startupMs: null },
  warnings: [],
  ...overrides,
});

const makeResult = (overrides: Partial<ExplainResult> = {}): ExplainResult => ({
  analyzeRan: true,
  engine: "postgresql",
  executionTimeMs: 42,
  raw: "Seq Scan on users",
  root: makeNode(),
  supportsAnalyze: true,
  ...overrides,
});

async function* makeTextStream(chunks: string[]): AsyncGenerator<string, void> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

vi.mock(import("@/lib/ai-settings"), () => ({
  getAISettings: vi.fn().mockResolvedValue({
    apiKey: "test-key",
    provider: "anthropic",
  }),
}));

vi.mock(import("@/lib/ai-provider"), () => ({
  createAIModel: vi.fn().mockReturnValue("mock-model"),
}));

const mockStreamText = vi.fn();
vi.mock(import("ai"), () => ({
  streamText: mockStreamText,
}));

const { usePlanNarrative } = await import("./use-plan-narrative");

describe("usePlanNarrative", () => {
  it("starts idle", () => {
    const { result } = renderHook(() => usePlanNarrative());
    expect(result.current.status).toBe("idle");
    expect(result.current.content).toBe("");
  });

  it("transitions to streaming then done on successful run", async () => {
    mockStreamText.mockReturnValue({
      textStream: makeTextStream(["Diagnosis: ", "slow scan"]),
    });

    const { result } = renderHook(() => usePlanNarrative());

    act(() => {
      result.current.run(makeResult(), "SELECT * FROM users");
    });

    await waitFor(() => expect(result.current.status).toBe("streaming"));
    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.content).toBe("Diagnosis: slow scan");
  });

  it("accumulates chunks incrementally", async () => {
    const chunks = ["chunk1", "chunk2", "chunk3"];
    mockStreamText.mockReturnValue({ textStream: makeTextStream(chunks) });

    const { result } = renderHook(() => usePlanNarrative());

    act(() => {
      result.current.run(makeResult(), "SELECT 1");
    });

    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.content).toBe("chunk1chunk2chunk3");
  });

  it("goes to unconfigured when AI settings are null", async () => {
    const { getAISettings } = await import("@/lib/ai-settings");
    vi.mocked(getAISettings).mockResolvedValueOnce(null);

    const { result } = renderHook(() => usePlanNarrative());

    act(() => {
      result.current.run(makeResult(), "SELECT 1");
    });

    await waitFor(() => expect(result.current.status).toBe("unconfigured"));
  });

  it("goes to error with retryable flag on network errors", async () => {
    const networkError = Object.assign(new Error("fetch failed"), {
      name: "Error",
    });
    async function* errorStream() {
      yield "";
      throw networkError;
    }
    mockStreamText.mockReturnValue({ textStream: errorStream() });

    const { result } = renderHook(() => usePlanNarrative());

    act(() => {
      result.current.run(makeResult(), "SELECT 1");
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.errorRetryable).toBeTruthy();
  });

  it("cancel() aborts and returns to idle", async () => {
    mockStreamText.mockReturnValue({
      textStream: makeTextStream(["partial"]),
    });

    const { result } = renderHook(() => usePlanNarrative());

    act(() => {
      result.current.run(makeResult(), "SELECT 1");
    });

    await waitFor(() => expect(result.current.status).toBe("streaming"));

    act(() => {
      result.current.cancel();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.content).toBe("");
  });

  it("reset() returns to idle and clears content", async () => {
    mockStreamText.mockReturnValue({ textStream: makeTextStream(["data"]) });

    const { result } = renderHook(() => usePlanNarrative());

    act(() => {
      result.current.run(makeResult(), "SELECT 1");
    });

    await waitFor(() => expect(result.current.status).toBe("done"));

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.content).toBe("");
  });

  it("aborts the controller on unmount to prevent state updates", () => {
    let abortCalled = false;
    const controller = {
      abort: () => {
        abortCalled = true;
      },
      signal: new AbortController().signal,
    };
    const originalAbortController = global.AbortController;
    global.AbortController = vi.fn(
      () => controller
    ) as unknown as typeof AbortController;

    mockStreamText.mockReturnValue({ textStream: makeTextStream([]) });

    const { result, unmount } = renderHook(() => usePlanNarrative());

    act(() => {
      result.current.run(makeResult(), "SELECT 1");
    });

    unmount();
    expect(abortCalled).toBeTruthy();

    global.AbortController = originalAbortController;
  });
});
