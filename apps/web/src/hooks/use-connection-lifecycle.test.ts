import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseConnection } from "@/lib/connections";

import { useConnectionLifecycle } from "@/hooks/use-connection-lifecycle";
import { mockTauri } from "@/test/tauri-mock";

const noop = vi.fn();

const makeConnection = (
  overrides: Partial<DatabaseConnection> = {}
): DatabaseConnection => ({
  createdAt: "2024-01-01T00:00:00.000Z",
  database: "app",
  host: "localhost",
  id: overrides.id ?? "conn-1",
  lastConnectedAt: null,
  name: "local",
  password: "",
  pinned: false,
  port: 5432,
  type: "postgresql",
  username: "postgres",
  ...overrides,
});

describe("useConnectionLifecycle", () => {
  it("connects, fetches version, and marks the connection as used", async () => {
    const calls: string[] = [];
    mockTauri({
      connect_to_database: (payload) => {
        calls.push("connect");
        expect(payload).toMatchObject({ connectionId: "conn-1" });
      },
      disconnect_from_database: () => {
        calls.push("disconnect");
      },
      get_connections: () => [],
      get_server_version: () => {
        calls.push("version");
        return "PostgreSQL 17.0";
      },
      save_connections: () => {
        calls.push("save");
      },
    });

    const connection = makeConnection();
    const { result } = renderHook(() => useConnectionLifecycle(connection));

    await waitFor(() => expect(result.current.isConnected).toBeTruthy());

    expect(result.current.serverVersion).toBe("PostgreSQL 17.0");
    expect(result.current.error).toBeNull();
    expect(calls[0]).toBe("connect");
    expect(calls).toContain("version");
  });

  it("captures connection errors", async () => {
    mockTauri({
      connect_to_database: () => {
        throw new Error("host unreachable");
      },
      disconnect_from_database: noop,
      get_server_version: () => "ignored",
    });

    const connection = makeConnection();
    const { result } = renderHook(() => useConnectionLifecycle(connection));

    await waitFor(() => expect(result.current.error).toBe("host unreachable"));
    expect(result.current.isConnected).toBeFalsy();
    expect(result.current.isConnecting).toBeFalsy();
  });

  it("still reports connected when version fetch fails", async () => {
    mockTauri({
      connect_to_database: noop,
      disconnect_from_database: noop,
      get_connections: () => [],
      get_server_version: () => {
        throw new Error("no version RPC");
      },
      save_connections: noop,
    });

    const connection = makeConnection();
    const { result } = renderHook(() => useConnectionLifecycle(connection));

    await waitFor(() => expect(result.current.isConnected).toBeTruthy());
    expect(result.current.serverVersion).toBeNull();
  });

  it("reconnect() triggers another connect cycle", async () => {
    const connect = vi.fn();
    mockTauri({
      connect_to_database: connect,
      disconnect_from_database: noop,
      get_connections: () => [],
      get_server_version: () => "PostgreSQL 17.0",
      save_connections: noop,
    });

    const connection = makeConnection();
    const { result } = renderHook(() => useConnectionLifecycle(connection));

    await waitFor(() => expect(result.current.isConnected).toBeTruthy());
    expect(connect).toHaveBeenCalledOnce();

    act(() => {
      result.current.reconnect();
    });

    await waitFor(() => expect(connect).toHaveBeenCalledTimes(2));
  });

  it("disconnects on unmount", async () => {
    const disconnect = vi.fn();
    mockTauri({
      connect_to_database: noop,
      disconnect_from_database: disconnect,
      get_connections: () => [],
      get_server_version: () => "PostgreSQL 17.0",
      save_connections: noop,
    });

    const connection = makeConnection();
    const { result, unmount } = renderHook(() =>
      useConnectionLifecycle(connection)
    );

    await waitFor(() => expect(result.current.isConnected).toBeTruthy());
    unmount();

    await waitFor(() =>
      expect(disconnect).toHaveBeenCalledWith(
        expect.objectContaining({ connectionId: "conn-1" })
      )
    );
  });
});
