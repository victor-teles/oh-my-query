import type * as Ai from "ai";

import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type * as AiProvider from "@/lib/ai-provider";
import type * as AiSettings from "@/lib/ai-settings";
import type * as ExplainAiContext from "@/lib/explain-ai-context";
import type { ExplainResult } from "@/lib/tauri";

const captured = vi.hoisted(() => ({ signals: [] as AbortSignal[] }));

const makeAbortError = (): Error => {
  const err = new Error("aborted");
  err.name = "AbortError";
  return err;
};

vi.mock<typeof Ai>(
  import("ai"),
  () =>
    ({
      streamText: vi.fn((opts: { abortSignal: AbortSignal }) => {
        captured.signals.push(opts.abortSignal);
        return {
          textStream: {
            [Symbol.asyncIterator]() {
              return {
                next: () => {
                  const { promise, reject } =
                    Promise.withResolvers<IteratorResult<string>>();
                  if (opts.abortSignal.aborted) {
                    reject(makeAbortError());
                  } else {
                    opts.abortSignal.addEventListener(
                      "abort",
                      () => reject(makeAbortError()),
                      { once: true }
                    );
                  }
                  return promise;
                },
              };
            },
          },
        };
      }),
    }) as unknown as typeof Ai
);

vi.mock<typeof AiSettings>(
  import("@/lib/ai-settings"),
  () =>
    ({
      getAISettings: vi
        .fn()
        .mockResolvedValue({ apiKey: "k", provider: "anthropic" }),
    }) as unknown as typeof AiSettings
);

vi.mock<typeof AiProvider>(
  import("@/lib/ai-provider"),
  () =>
    ({
      createAIModel: vi.fn(() => ({})),
    }) as unknown as typeof AiProvider
);

vi.mock<typeof ExplainAiContext>(import("@/lib/explain-ai-context"), () => ({
  buildExplainNarrativePrompt: vi.fn(() => "prompt"),
}));

const { useExplainAiNarrative } =
  await import("@/hooks/use-explain-ai-narrative");

const makeResult = (id = "root"): ExplainResult => ({
  analyzeRan: false,
  engine: "postgresql",
  executionTimeMs: 10,
  raw: "Seq Scan",
  root: {
    children: [],
    cost: { actualTotalMs: 10, selfMs: 10, startup: null, total: null },
    details: [],
    id,
    label: "Seq Scan",
    nodeType: "Seq Scan",
    rows: { actual: 1, estimated: 1 },
    timing: { actualTotalMs: 10, loops: 1, startupMs: null },
    warnings: [],
  },
  supportsAnalyze: true,
});

describe("useExplainAiNarrative", () => {
  it("does not collapse a newer run when the previous run's AbortError resolves late", async () => {
    captured.signals = [];
    const { result } = renderHook(() => useExplainAiNarrative());

    result.current.analyze(makeResult("a"), "SELECT 1");
    await waitFor(() => {
      expect(captured.signals).toHaveLength(1);
    });

    result.current.analyze(makeResult("b"), "SELECT 2");
    await waitFor(() => {
      expect(captured.signals).toHaveLength(2);
    });

    expect(captured.signals[0]?.aborted).toBeTruthy();
    expect(captured.signals[1]?.aborted).toBeFalsy();

    await waitFor(() => {
      expect(["loading", "streaming"]).toContain(result.current.state.status);
    });
  });

  it("aborts the in-flight stream when the hook unmounts", async () => {
    captured.signals = [];
    const { result, unmount } = renderHook(() => useExplainAiNarrative());

    result.current.analyze(makeResult(), "SELECT 1");
    await waitFor(() => {
      expect(captured.signals).toHaveLength(1);
    });

    expect(captured.signals[0]?.aborted).toBeFalsy();

    unmount();

    expect(captured.signals[0]?.aborted).toBeTruthy();
  });
});
