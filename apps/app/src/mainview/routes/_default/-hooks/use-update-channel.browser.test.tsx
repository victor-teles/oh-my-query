import { act } from "react";
import { describe, expect, it } from "vitest";

import { renderHook, waitFor } from "@/test/render-hook";
import { mockTauri } from "@/test/tauri-mock";

import type { CheckState } from "./use-update-channel";

import { useUpdateChannel } from "./use-update-channel";

const availableVersion = (state: CheckState): string | null =>
  state.status === "available" ? state.update.version : null;

describe("useUpdateChannel", () => {
  it("loads the persisted channel on mount", async () => {
    mockTauri({
      getUpdateChannel: () => "beta",
    });

    const { result } = renderHook(() => useUpdateChannel());
    await waitFor(() => expect(result.current.loading).toBeFalsy());
    expect(result.current.channel).toBe("beta");
    expect(result.current.pendingRestart).toBeFalsy();
  });

  it("writes a new channel and flips pendingRestart", async () => {
    let stored = "stable";
    mockTauri({
      getUpdateChannel: () => stored,
      setUpdateChannel: (payload) => {
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
    mockTauri({
      checkForUpdate: () => null,
      getUpdateChannel: () => "stable",
    });

    const { result } = renderHook(() => useUpdateChannel());
    await waitFor(() => expect(result.current.loading).toBeFalsy());

    await act(async () => {
      await result.current.checkNow();
    });

    expect(result.current.check.status).toBe("no-update");
  });

  it("checkNow surfaces an available update", async () => {
    mockTauri({
      checkForUpdate: () => ({
        currentVersion: "0.0.10",
        date: null,
        notes: "fixes",
        version: "0.0.11",
      }),
      getUpdateChannel: () => "stable",
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
