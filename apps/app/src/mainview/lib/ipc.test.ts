import { describe, expect, it, vi } from "vitest";

import { mockTauri } from "@/test/tauri-mock";

const flushAsync = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("rendererReady handshake", () => {
  it("fires onBunReady handlers registered before the request resolves", async () => {
    vi.resetModules();
    const ready = Promise.withResolvers<void>();
    mockTauri({
      rendererReady: () => ready.promise,
    });

    const ipc = await import("@/lib/ipc");
    const handler = vi.fn();
    ipc.onBunReady(handler);

    await flushAsync();
    expect(handler).not.toHaveBeenCalled();

    ready.resolve();
    await flushAsync();

    expect(handler).toHaveBeenCalledOnce();
  });

  it("fires immediately for handlers registered after the request resolves", async () => {
    vi.resetModules();
    const ready = Promise.withResolvers<void>();
    mockTauri({
      rendererReady: () => ready.promise,
    });

    await import("@/lib/ipc");
    ready.resolve();
    await flushAsync();

    const ipc = await import("@/lib/ipc");
    const handler = vi.fn();
    ipc.onBunReady(handler);

    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not fire handlers that unsubscribe before the request resolves", async () => {
    vi.resetModules();
    const ready = Promise.withResolvers<void>();
    mockTauri({
      rendererReady: () => ready.promise,
    });

    const ipc = await import("@/lib/ipc");
    const handler = vi.fn();
    const unsubscribe = ipc.onBunReady(handler);
    unsubscribe();

    ready.resolve();
    await flushAsync();

    expect(handler).not.toHaveBeenCalled();
  });

  it("logs but does not throw when the handshake rejects", async () => {
    vi.resetModules();
    const consoleError = vi.spyOn(console, "error").mockReturnValue();
    const ready = Promise.withResolvers<void>();
    mockTauri({
      rendererReady: () => ready.promise,
    });

    await import("@/lib/ipc");
    ready.reject(new Error("transport offline"));
    await flushAsync();

    expect(consoleError).toHaveBeenCalledWith(
      "[ipc] rendererReady handshake failed",
      expect.any(Error)
    );
    consoleError.mockRestore();
  });
});

describe("browser-mode IPC stub", () => {
  const ELECTROBUN_KEY = "__electrobunWebviewId";

  const enterBrowserMode = () => {
    vi.resetModules();
    const w = window as unknown as Record<string, unknown>;
    const previous = w[ELECTROBUN_KEY];
    Reflect.deleteProperty(w, ELECTROBUN_KEY);
    localStorage.clear();
    return {
      restore: () => {
        if (previous !== undefined) {
          w[ELECTROBUN_KEY] = previous;
        }
      },
    };
  };

  it("strips password before persisting connections to localStorage", async () => {
    const { restore } = await enterBrowserMode();
    const ipc = await import("@/lib/ipc");

    await ipc.saveConnections([
      {
        createdAt: new Date(0).toISOString(),
        database: "appdb",
        host: "db.internal",
        id: "conn-1",
        lastConnectedAt: null,
        name: "Prod",
        password: "super-secret",
        pinned: false,
        port: 5432,
        type: "postgresql",
        username: "admin",
      },
    ] as never);

    const stored = localStorage.getItem("oh-my-query-connections");
    expect(stored).not.toBeNull();
    expect(stored).not.toContain("super-secret");
    const parsed = JSON.parse(String(stored)) as { password: string }[];
    expect(parsed[0]?.password).toBe("");

    restore();
  });

  it("treats saveConfig as a no-op instead of throwing", async () => {
    const { restore } = await enterBrowserMode();
    const ipc = await import("@/lib/ipc");

    await expect(
      ipc.saveConfig({ ai: null } as never)
    ).resolves.toBeUndefined();

    restore();
  });
});
