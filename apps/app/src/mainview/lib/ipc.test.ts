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
