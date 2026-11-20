import { describe, expect, it, vi } from "vitest";

import { makeConnection } from "@/test/connection-fixture";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";

import { useConnections } from "./connections-provider";

const analytics = makeConnection({ id: "analytics", name: "analytics" });

type Context = ReturnType<typeof useConnections>;

const renderProbe = () => {
  const probe: { current: Context | null } = { current: null };
  function Probe() {
    probe.current = useConnections();
    return null;
  }
  renderWithConnections(<Probe />);
  const get = (): Context => {
    if (!probe.current) {
      throw new Error("provider did not render");
    }
    return probe.current;
  };
  return get;
};

const ready = async (get: () => Context) => {
  await expect.poll(() => get().state.load.status).toBe("ready");
};

describe("connectionsProvider", () => {
  it("reports a failed test from the driver", async () => {
    mockLauncherIpc({
      connections: [analytics],
      handlers: {
        testConnection: () => ({
          latencyMs: 0,
          message: "connection refused",
          success: false,
        }),
      },
    });
    const get = renderProbe();
    await ready(get);

    await get().test(analytics);
    await expect
      .poll(() => get().state.activity.analytics)
      .toStrictEqual({
        kind: "error",
        message: "connection refused",
      });
  });

  it("reports a test that could not run", async () => {
    mockLauncherIpc({
      connections: [analytics],
      handlers: {
        testConnection: vi.fn().mockRejectedValue(new Error("timeout")),
      },
    });
    const get = renderProbe();
    await ready(get);

    await get().test(analytics);
    await expect
      .poll(() => get().state.activity.analytics)
      .toStrictEqual({
        kind: "error",
        message: "timeout",
      });
  });

  it.each(["remove", "togglePin"] as const)(
    "surfaces a failed %s on the row",
    async (operation) => {
      mockLauncherIpc({
        connections: [analytics],
        handlers: {
          saveConnections: vi.fn().mockRejectedValue(new Error("EACCES")),
        },
      });
      const get = renderProbe();
      await ready(get);

      await get()[operation](analytics);
      await expect
        .poll(() => get().state.activity.analytics)
        .toStrictEqual({
          kind: "error",
          message: "EACCES",
        });
    }
  );

  it("surfaces a failed disconnect on the row", async () => {
    mockLauncherIpc({
      connections: [analytics],
      handlers: {
        disconnectFromDatabase: vi.fn().mockRejectedValue(new Error("busy")),
      },
    });
    const get = renderProbe();
    await ready(get);
    await get().activate(analytics);
    await expect.poll(() => get().state.liveIds).toStrictEqual(["analytics"]);

    await get().disconnect(analytics);
    await expect
      .poll(() => get().state.activity.analytics)
      .toStrictEqual({
        kind: "error",
        message: "busy",
      });
  });

  it("drops a live session when saved credentials change", async () => {
    const disconnect = vi.fn();
    mockLauncherIpc({
      connections: [analytics],
      handlers: { disconnectFromDatabase: (payload) => disconnect(payload) },
    });
    const get = renderProbe();
    await ready(get);
    await get().activate(analytics);
    await expect.poll(() => get().state.liveIds).toStrictEqual(["analytics"]);

    get().saved({ ...analytics, host: "replica.internal" }, analytics);
    await expect.poll(() => get().state.liveIds).toStrictEqual([]);
    expect(disconnect).toHaveBeenCalledWith({ connectionId: "analytics" });
  });
});
