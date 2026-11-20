import { describe, expect, it } from "vitest";

import { makeConnection } from "@/test/connection-fixture";

import type { ConnectionsState } from "./connections-reducer";

import {
  connectionsReducer,
  initialConnectionsState,
} from "./connections-reducer";

const alpha = makeConnection({ id: "alpha", name: "alpha" });
const beta = makeConnection({ id: "beta", name: "beta" });

const loaded = (overrides: Partial<ConnectionsState> = {}) => ({
  ...connectionsReducer(initialConnectionsState, {
    activeId: null,
    connections: [alpha, beta],
    type: "loaded",
  }),
  ...overrides,
});

describe("connectionsReducer", () => {
  it("drops a persisted active id whose connection no longer exists", () => {
    const state = connectionsReducer(initialConnectionsState, {
      activeId: "gone",
      connections: [alpha],
      type: "loaded",
    });
    expect(state.activeId).toBeNull();
    expect(state.load).toStrictEqual({ status: "ready" });
  });

  it("keeps an existing active id", () => {
    const state = connectionsReducer(initialConnectionsState, {
      activeId: "alpha",
      connections: [alpha],
      type: "loaded",
    });
    expect(state.activeId).toBe("alpha");
  });

  it("tracks load failures and reloads", () => {
    const failed = connectionsReducer(initialConnectionsState, {
      message: "Decryption failed",
      type: "load-failed",
    });
    expect(failed.load).toStrictEqual({
      message: "Decryption failed",
      status: "error",
    });
    expect(connectionsReducer(failed, { type: "loading" }).load).toStrictEqual({
      status: "loading",
    });
  });

  it("sets and clears row activity", () => {
    const busy = connectionsReducer(loaded(), {
      activity: { kind: "testing" },
      id: "alpha",
      type: "activity",
    });
    expect(busy.activity).toStrictEqual({ alpha: { kind: "testing" } });
    const idle = connectionsReducer(busy, {
      activity: null,
      id: "alpha",
      type: "activity",
    });
    expect(idle.activity).toStrictEqual({});
  });

  it("settles an activity only if it has not changed since", () => {
    const connected = loaded({ activity: { alpha: { kind: "connected" } } });
    const settled = connectionsReducer(connected, {
      id: "alpha",
      kind: "connected",
      type: "activity-settled",
    });
    expect(settled.activity).toStrictEqual({});
    const unchanged = connectionsReducer(connected, {
      id: "alpha",
      kind: "tested",
      type: "activity-settled",
    });
    expect(unchanged).toBe(connected);
  });

  it("activates a connection: active, live, used and marked connected", () => {
    const state = connectionsReducer(loaded(), {
      id: "beta",
      type: "activated",
      usedAt: "2026-11-17T10:00:00.000Z",
    });
    expect(state.activeId).toBe("beta");
    expect(state.liveIds).toStrictEqual(["beta"]);
    expect(state.activity.beta).toStrictEqual({ kind: "connected" });
    expect(state.connections[1]?.lastConnectedAt).toBe(
      "2026-11-17T10:00:00.000Z"
    );
  });

  it("disconnecting the active connection clears the chip", () => {
    const state = connectionsReducer(
      loaded({ activeId: "alpha", liveIds: ["alpha", "beta"] }),
      { id: "alpha", type: "disconnected" }
    );
    expect(state.activeId).toBeNull();
    expect(state.liveIds).toStrictEqual(["beta"]);
  });

  it("disconnecting another connection keeps the active one", () => {
    const state = connectionsReducer(
      loaded({ activeId: "alpha", liveIds: ["beta"] }),
      { id: "beta", type: "disconnected" }
    );
    expect(state.activeId).toBe("alpha");
  });

  it("removes a connection and everything that points at it", () => {
    const state = connectionsReducer(
      loaded({ activeId: "alpha", focusId: "alpha", liveIds: ["alpha"] }),
      { id: "alpha", type: "removed" }
    );
    expect(state.connections).toStrictEqual([beta]);
    expect(state.activeId).toBeNull();
    expect(state.focusId).toBeNull();
    expect(state.liveIds).toStrictEqual([]);
  });

  it("keeps unrelated focus when removing", () => {
    const state = connectionsReducer(loaded({ focusId: "beta" }), {
      id: "alpha",
      type: "removed",
    });
    expect(state.focusId).toBe("beta");
  });

  it("toggles pins", () => {
    const state = connectionsReducer(loaded(), {
      id: "alpha",
      type: "pin-toggled",
    });
    expect(state.connections[0]?.pinned).toBeTruthy();
  });

  it("adds a new connection and focuses it", () => {
    const gamma = makeConnection({ id: "gamma", name: "gamma" });
    const state = connectionsReducer(loaded(), {
      connection: gamma,
      stale: false,
      type: "saved",
    });
    expect(state.connections).toHaveLength(3);
    expect(state.focusId).toBe("gamma");
  });

  it("replaces an edited connection and drops a stale session", () => {
    const renamed = { ...alpha, host: "db.internal" };
    const state = connectionsReducer(loaded({ liveIds: ["alpha"] }), {
      connection: renamed,
      stale: true,
      type: "saved",
    });
    expect(state.connections[0]?.host).toBe("db.internal");
    expect(state.liveIds).toStrictEqual([]);
  });

  it("keeps the session when the edit did not touch credentials", () => {
    const state = connectionsReducer(loaded({ liveIds: ["alpha"] }), {
      connection: { ...alpha, name: "Alpha" },
      stale: false,
      type: "saved",
    });
    expect(state.liveIds).toStrictEqual(["alpha"]);
  });

  it("ignores unknown actions", () => {
    const state = loaded();
    expect(connectionsReducer(state, { type: "noop" } as never)).toBe(state);
  });
});
