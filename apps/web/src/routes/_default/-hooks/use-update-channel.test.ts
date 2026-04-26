import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { mockTauri } from "@/test/tauri-mock";

import type { CheckState } from "./use-update-channel";

import { useUpdateChannel } from "./use-update-channel";

const enableTauri = () => {
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    value: {},
    writable: true,
  });
};

const availableVersion = (state: CheckState): string | null =>
  state.status === "available" ? state.update.version : null;

describe("useUpdateChannel (web)", () => {
  it("reports unsupported when not in Tauri", async () => {
    const { result } = renderHook(() => useUpdateChannel());
    await waitFor(() => expect(result.current.loading).toBeFalsy());
    expect(result.current.supported).toBeFalsy();
  });
});

describe("useUpdateChannel (tauri)", () => {
  it("loads the persisted channel on mount", async () => {
    enableTauri();
    mockTauri({
      get_update_channel: () => "beta",
    });

    const { result } = renderHook(() => useUpdateChannel());
    await waitFor(() => expect(result.current.loading).toBeFalsy());
    expect(result.current.channel).toBe("beta");
    expect(result.current.pendingRestart).toBeFalsy();
  });

  it("writes a new channel and flips pendingRestart", async () => {
    enableTauri();
    let stored = "stable";
    mockTauri({
      get_update_channel: () => stored,
      set_update_channel: (payload) => {
        stored = payload.channel as string;
        return stored;
      },
    });

    const { result } = renderHook(() => useUpdateChannel());
    await waitFor(() => expect(result.current.loading).toBeFalsy());

    await act(async () => {
      await result.current.setChannel("beta");
    });

    expect(result.current.channel).toBe("beta");
    expect(result.current.pendingRestart).toBeTruthy();
  });

  it("checkNow surfaces no-update when the backend returns null", async () => {
    enableTauri();
    mockTauri({
      check_for_update: () => null,
      get_update_channel: () => "stable",
    });

    const { result } = renderHook(() => useUpdateChannel());
    await waitFor(() => expect(result.current.loading).toBeFalsy());

    await act(async () => {
      await result.current.checkNow();
    });

    expect(result.current.check.status).toBe("no-update");
  });

  it("checkNow surfaces an available update", async () => {
    enableTauri();
    mockTauri({
      check_for_update: () => ({
        currentVersion: "0.0.10",
        date: null,
        notes: "fixes",
        version: "0.0.11",
      }),
      get_update_channel: () => "stable",
    });

    const { result } = renderHook(() => useUpdateChannel());
    await waitFor(() => expect(result.current.loading).toBeFalsy());

    await act(async () => {
      await result.current.checkNow();
    });

    expect(result.current.check.status).toBe("available");
    expect(availableVersion(result.current.check)).toBe("0.0.11");
  });
});
