import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import type { HistoryEntry, HistoryFilters } from "@/lib/persistence";

import { mockTauri } from "@/test/tauri-mock";

const { useAllQueryHistory } = await import("@/hooks/use-all-query-history");
const { HISTORY_UPDATED_EVENT } = await import("@/lib/persistence");

const makeEntry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  connectionId: "conn-a",
  database: null,
  dialect: "postgresql",
  error: null,
  executionTimeMs: 10,
  sql: "SELECT 1",
  success: true,
  timestamp: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("useAllQueryHistory", () => {
  it("calls get_all_history with the filters and returns entries", async () => {
    const entries = [makeEntry({ sql: "one" }), makeEntry({ sql: "two" })];
    const getAll = vi.fn(() => entries);
    mockTauri({ getAllHistory: getAll });

    const filters = { erroredOnly: true };
    const { result } = renderHook(() => useAllQueryHistory(filters));

    await waitFor(() => expect(result.current.isLoading).toBeFalsy());
    expect(result.current.entries).toStrictEqual(entries);
    expect(getAll).toHaveBeenCalledWith({ filters });
  });

  it("refreshes when HISTORY_UPDATED_EVENT fires", async () => {
    const getAll = vi.fn(() => []);
    mockTauri({ getAllHistory: getAll });

    const { result } = renderHook(() => useAllQueryHistory({}));
    await waitFor(() => expect(result.current.isLoading).toBeFalsy());
    expect(getAll).toHaveBeenCalledOnce();

    act(() => {
      window.dispatchEvent(new CustomEvent(HISTORY_UPDATED_EVENT));
    });

    await waitFor(() => expect(getAll).toHaveBeenCalledTimes(2));
  });

  it("reports errors thrown by the backend", async () => {
    mockTauri({
      getAllHistory: () => {
        throw new Error("boom");
      },
    });

    const { result } = renderHook(() => useAllQueryHistory({}));

    await waitFor(() => expect(result.current.isLoading).toBeFalsy());
    expect(result.current.error).toBe("boom");
    expect(result.current.entries).toStrictEqual([]);
  });

  it("flips isLoading back to true when filters change", async () => {
    const entries = [makeEntry()];
    const getAll = vi.fn(() => entries);
    mockTauri({ getAllHistory: getAll });

    const { result, rerender } = renderHook(
      ({ filters }: { filters: HistoryFilters }) => useAllQueryHistory(filters),
      { initialProps: { filters: { erroredOnly: false } } }
    );

    await waitFor(() => expect(result.current.isLoading).toBeFalsy());

    rerender({ filters: { erroredOnly: true } });

    expect(result.current.isLoading).toBeTruthy();
    await waitFor(() => expect(result.current.isLoading).toBeFalsy());
    expect(getAll).toHaveBeenCalledTimes(2);
  });

  it("discards stale responses from earlier in-flight requests", async () => {
    const slowEntries = [makeEntry({ sql: "slow" })];
    const fastEntries = [makeEntry({ sql: "fast" })];

    let slowResolve!: () => void;
    // eslint-disable-next-line promise/avoid-new
    const slowPromise = new Promise<void>((resolve) => {
      slowResolve = resolve;
    });

    const getAll = vi.fn();
    getAll.mockImplementationOnce(async () => {
      await slowPromise;
      return slowEntries;
    });
    getAll.mockImplementation(() => fastEntries);

    mockTauri({ getAllHistory: getAll });

    const { result, rerender } = renderHook(
      ({ filters }: { filters: HistoryFilters }) => useAllQueryHistory(filters),
      { initialProps: { filters: { erroredOnly: false } } }
    );

    rerender({ filters: { erroredOnly: true } });

    await waitFor(() => {
      expect(result.current.entries).toStrictEqual(fastEntries);
    });

    act(() => {
      slowResolve();
    });

    await waitFor(() => expect(getAll).toHaveBeenCalledTimes(2));
    expect(result.current.entries).toStrictEqual(fastEntries);
    expect(result.current.isLoading).toBeFalsy();
  });
});
