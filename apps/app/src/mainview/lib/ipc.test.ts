import { describe, expect, it, vi } from "vitest";

import type { AskEvent } from "@/lib/ipc";

import { emitIpcMessage, mockIpc } from "@/test/ipc-mock";

const flushAsync = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("rendererReady handshake", () => {
  it("fires onBunReady handlers registered before the request resolves", async () => {
    vi.resetModules();
    const ready = Promise.withResolvers<void>();
    mockIpc({
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
    mockIpc({
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
    mockIpc({
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
    mockIpc({
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

const pressLauncherHotkey = () =>
  window.dispatchEvent(
    new KeyboardEvent("keydown", {
      altKey: true,
      code: "Space",
      shiftKey: true,
    })
  );

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

  it("emulates the global hotkey: toggle while visible, show after hide", async () => {
    const { restore } = await enterBrowserMode();
    const ipc = await import("@/lib/ipc");
    const shown = vi.fn();
    const toggled = vi.fn();
    ipc.onLauncherShown(shown);
    ipc.onLauncherToggle(toggled);
    pressLauncherHotkey();
    expect(toggled).toHaveBeenCalledOnce();

    await ipc.hideLauncher();
    await ipc.resizeLauncher(200);
    pressLauncherHotkey();
    expect(shown).toHaveBeenCalledOnce();

    restore();
  });

  it("keeps AI settings redacted and in memory", async () => {
    const { restore } = await enterBrowserMode();
    const ipc = await import("@/lib/ipc");

    await expect(ipc.getAiSettings()).resolves.toBeNull();
    const saved = await ipc.saveAiSettings({
      apiKey: "sk-test-0123456789abcd",
      provider: "anthropic",
    });
    expect(saved).toStrictEqual({
      baseUrl: null,
      hasKey: true,
      keyHint: "abcd",
      model: null,
      provider: "anthropic",
    });
    expect(JSON.stringify(localStorage)).not.toContain("sk-test");

    restore();
  });

  it("keeps the key for the same provider and drops it on a switch", async () => {
    const { restore } = await enterBrowserMode();
    const ipc = await import("@/lib/ipc");
    await ipc.saveAiSettings({
      apiKey: "sk-test-0123456789abcd",
      provider: "anthropic",
    });

    await expect(
      ipc.saveAiSettings({ model: "claude-haiku-5-5", provider: "anthropic" })
    ).resolves.toMatchObject({ hasKey: true, keyHint: "abcd" });
    await expect(
      ipc.saveAiSettings({ provider: "openai" })
    ).resolves.toMatchObject({ hasKey: false, keyHint: null });
    await expect(ipc.clearAiKey()).resolves.toMatchObject({ hasKey: false });
    await expect(
      ipc.testAiSettings({ provider: "openai" })
    ).resolves.toMatchObject({ ok: false });

    restore();
  });

  it("persists the active connection across reloads", async () => {
    const { restore } = await enterBrowserMode();
    const ipc = await import("@/lib/ipc");

    await ipc.setActiveConnection({ connectionId: "conn-1", database: "app" });
    vi.resetModules();
    const reloaded = await import("@/lib/ipc");
    await expect(reloaded.getActiveConnection()).resolves.toStrictEqual({
      connectionId: "conn-1",
      database: "app",
    });

    await reloaded.setActiveConnection(null);
    await expect(reloaded.getActiveConnection()).resolves.toBeNull();

    restore();
  });

  it("reports the default hotkey and a dev version", async () => {
    const { restore } = await enterBrowserMode();
    const ipc = await import("@/lib/ipc");

    await expect(ipc.getLauncherHotkey()).resolves.toBe("Option+Shift+Space");
    await expect(ipc.getAppVersion()).resolves.toBe("dev");

    restore();
  });

  it("plays a scripted ask that ends in a card and done", async () => {
    vi.useFakeTimers();
    const { restore } = await enterBrowserMode();
    const ipc = await import("@/lib/ipc");
    const events: string[] = [];
    ipc.onAskEvent("ask-1", (event) => events.push(event.type));

    await ipc.ask({
      askId: "ask-1",
      connectionId: "conn-1",
      database: null,
      prompt: "Revenue by region",
    });
    await vi.runAllTimersAsync();

    expect(events[0]).toBe("phase");
    expect(events).toContain("sqlDone");
    expect(events.slice(-2)).toStrictEqual(["card", "done"]);
    vi.useRealTimers();
    restore();
  });

  it("cancels a scripted ask", async () => {
    vi.useFakeTimers();
    const { restore } = await enterBrowserMode();
    const ipc = await import("@/lib/ipc");
    const events: AskEvent[] = [];
    ipc.onAskEvent("ask-2", (event) => events.push(event));

    await ipc.ask({
      askId: "ask-2",
      connectionId: "conn-1",
      database: null,
      prompt: "q",
    });
    await vi.advanceTimersByTimeAsync(200);
    await ipc.cancelAsk("ask-2");
    await vi.runAllTimersAsync();

    expect(events.at(-1)).toMatchObject({ code: "CANCELLED", type: "error" });
    expect(events.some((event) => event.type === "done")).toBeFalsy();
    vi.useRealTimers();
    restore();
  });

  it("rejects requests the stub does not implement", async () => {
    const { restore } = await enterBrowserMode();
    const ipc = await import("@/lib/ipc");

    await expect(ipc.formatSql("select 1", "postgres")).rejects.toThrow(
      "does not implement 'formatSql'"
    );

    restore();
  });
});

describe("launcher messages", () => {
  const loadIpc = async () => {
    vi.resetModules();
    mockIpc({ rendererReady: vi.fn() });
    return await import("@/lib/ipc");
  };

  it("delivers launcher lifecycle messages to subscribers", async () => {
    const ipc = await loadIpc();
    const shown = vi.fn();
    const toggled = vi.fn();
    const dismissed = vi.fn();
    ipc.onLauncherShown(shown);
    ipc.onLauncherToggle(toggled);
    ipc.onLauncherDismiss(dismissed);

    emitIpcMessage("launcherShown");
    emitIpcMessage("launcherToggle");
    emitIpcMessage("launcherDismiss");

    expect(shown).toHaveBeenCalledOnce();
    expect(toggled).toHaveBeenCalledOnce();
    expect(dismissed).toHaveBeenCalledOnce();
  });

  it("unwraps navigate and progress payloads", async () => {
    const ipc = await loadIpc();
    const navigated = vi.fn();
    const progress = vi.fn();
    ipc.onLauncherNavigate(navigated);
    ipc.onUpdateProgress(progress);

    emitIpcMessage("launcherNavigate", { view: "settings" });
    emitIpcMessage("updateProgress", { downloaded: 1, percent: 50, total: 2 });

    expect(navigated).toHaveBeenCalledWith("settings");
    expect(progress).toHaveBeenCalledWith({
      downloaded: 1,
      percent: 50,
      total: 2,
    });
  });

  it("stops delivering after unsubscribe", async () => {
    const ipc = await loadIpc();
    const shown = vi.fn();
    const unsubscribe = ipc.onLauncherShown(shown);

    unsubscribe();
    emitIpcMessage("launcherShown");

    expect(shown).not.toHaveBeenCalled();
  });

  it("forwards resize and hide requests to bun", async () => {
    vi.resetModules();
    const resize = vi.fn();
    const hide = vi.fn();
    mockIpc({
      hideLauncher: () => hide(),
      rendererReady: vi.fn(),
      resizeLauncher: (payload) => resize(payload),
    });
    const ipc = await import("@/lib/ipc");

    await ipc.resizeLauncher(320);
    await ipc.hideLauncher();

    expect(resize).toHaveBeenCalledWith({ height: 320 });
    expect(hide).toHaveBeenCalledOnce();
  });
});

describe("ask", () => {
  const loadIpc = async (handlers: Parameters<typeof mockIpc>[0] = {}) => {
    vi.resetModules();
    mockIpc({ rendererReady: vi.fn(), ...handlers });
    return await import("@/lib/ipc");
  };

  it("delivers only the events for the subscribed ask", async () => {
    const ipc = await loadIpc();
    const handler = vi.fn();
    ipc.onAskEvent("mine", handler);

    emitIpcMessage("askEvent", { askId: "other", event: { type: "done" } });
    emitIpcMessage("askEvent", { askId: "mine", event: { type: "done" } });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ type: "done" });
  });

  it("stops delivering after unsubscribe", async () => {
    const ipc = await loadIpc();
    const handler = vi.fn();
    const unsubscribe = ipc.onAskEvent("mine", handler);

    unsubscribe();
    emitIpcMessage("askEvent", { askId: "mine", event: { type: "done" } });

    expect(handler).not.toHaveBeenCalled();
  });

  it("forwards ask and cancelAsk requests to bun", async () => {
    const asked = vi.fn();
    const cancelled = vi.fn();
    const ipc = await loadIpc({
      ask: (payload) => asked(payload),
      cancelAsk: (payload) => cancelled(payload),
    });
    const params = {
      askId: "a1",
      connectionId: "c1",
      database: "analytics",
      prompt: "Revenue by region",
    };

    await ipc.ask(params);
    await ipc.cancelAsk("a1");

    expect(asked).toHaveBeenCalledWith(params);
    expect(cancelled).toHaveBeenCalledWith({ askId: "a1" });
  });
});
