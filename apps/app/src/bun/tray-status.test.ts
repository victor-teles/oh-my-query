import { describe, expect, it } from "vitest";

import type { PinnedStatus, TrayStatus } from "./tray-status.ts";

import {
  EMPTY_TRAY_STATUS,
  TRAY_ACTIONS,
  trayActionOf,
  trayMenu,
  trayTitle,
} from "./tray-status.ts";

const NOW = Date.parse("2026-11-19T10:00:00.000Z");
const MINUTE = 60_000;

const pinned = (overrides: Partial<PinnedStatus> = {}): PinnedStatus => ({
  display: "$12.4k",
  failing: false,
  intervalMs: 5 * MINUTE,
  lastAttemptAt: NOW - 2 * MINUTE,
  lastSuccessAt: NOW - 2 * MINUTE,
  watchId: "watch-1",
  widgetId: "w1",
  widgetName: "MRR",
  ...overrides,
});

const status = (overrides: Partial<TrayStatus> = {}): TrayStatus => ({
  ...EMPTY_TRAY_STATUS,
  now: NOW,
  ...overrides,
});

const labels = (menu: ReturnType<typeof trayMenu>) =>
  menu.map((item) => (item.type === "normal" ? item.label : "—"));

describe("trayTitle", () => {
  it("is empty when nothing is pinned", () => {
    expect(trayTitle(status())).toBe("");
  });

  it("shows the compact value while it is fresh", () => {
    expect(trayTitle(status({ pinned: pinned() }))).toBe("$12.4k");
  });

  it("ellipsizes long values to ten characters", () => {
    expect(
      trayTitle(status({ pinned: pinned({ display: "1234567890123" }) }))
    ).toBe("123456789…");
  });

  it("keeps the last value up to three intervals, then shows a dash", () => {
    const fresh = pinned({ failing: true, lastSuccessAt: NOW - 15 * MINUTE });
    expect(trayTitle(status({ pinned: fresh }))).toBe("$12.4k");
    const stale = pinned({ failing: true, lastSuccessAt: NOW - 16 * MINUTE });
    expect(trayTitle(status({ pinned: stale }))).toBe("—");
    expect(
      trayTitle(
        status({ pinned: pinned({ display: null, lastSuccessAt: null }) })
      )
    ).toBe("—");
  });
});

describe("trayMenu", () => {
  it("is the base menu when nothing is watched", () => {
    expect(labels(trayMenu(status()))).toStrictEqual([
      "Open Launcher",
      "Settings…",
      "—",
      "Quit Conch",
    ]);
  });

  it("lists the pinned KPI, unseen alerts and the watch count", () => {
    const menu = trayMenu(
      status({
        alerts: [
          {
            firedAt: NOW - 4 * MINUTE,
            label: "MRR below $50k",
            watchId: "watch-1",
            widgetId: "w1",
          },
        ],
        pinned: pinned(),
        watching: 4,
      })
    );
    expect(labels(menu)).toStrictEqual([
      "MRR · $12.4k · 2m ago",
      "Open MRR",
      "MRR below $50k · 4m ago",
      "Watching 4 widgets…",
      "—",
      "Open Launcher",
      "Settings…",
      "—",
      "Quit Conch",
    ]);
    expect(menu[0]).toMatchObject({ enabled: false });
    expect(menu[1]).toMatchObject({
      action: TRAY_ACTIONS.openWatched,
      data: { watchId: "watch-1", widgetId: "w1" },
    });
    expect(menu[3]).toMatchObject({ action: TRAY_ACTIONS.watches });
  });

  it("says why the value is stale", () => {
    const failing = pinned({ failing: true, lastAttemptAt: NOW - MINUTE });
    expect(labels(trayMenu(status({ pinned: failing }))).at(0)).toBe(
      "MRR · couldn't refresh · 1m ago"
    );
    expect(
      labels(trayMenu(status({ paused: true, pinned: pinned(), watching: 1 })))
    ).toContain("Watching paused · 1 widget…");
    expect(
      labels(trayMenu(status({ paused: true, pinned: pinned() }))).at(0)
    ).toBe("MRR · watching paused · 2m ago");
    expect(
      labels(
        trayMenu(
          status({
            pinned: pinned({
              display: null,
              lastAttemptAt: null,
              lastSuccessAt: null,
            }),
          })
        )
      ).at(0)
    ).toBe("MRR · waiting for the first run");
  });

  it("shows at most five alerts", () => {
    const alerts = Array.from({ length: 7 }, (_, index) => ({
      firedAt: NOW,
      label: `Alert ${index}`,
      watchId: `watch-${index}`,
      widgetId: `w${index}`,
    }));
    const menu = trayMenu(status({ alerts }));
    expect(
      labels(menu).filter((label) => label.startsWith("Alert"))
    ).toHaveLength(5);
  });
});

describe("trayActionOf", () => {
  it("reads the base actions", () => {
    expect(trayActionOf({ data: { action: TRAY_ACTIONS.open } })).toStrictEqual(
      {
        kind: "open",
      }
    );
    expect(
      trayActionOf({ data: { action: TRAY_ACTIONS.settings } })
    ).toStrictEqual({ kind: "settings" });
    expect(trayActionOf({ data: { action: TRAY_ACTIONS.quit } })).toStrictEqual(
      {
        kind: "quit",
      }
    );
    expect(
      trayActionOf({ data: { action: TRAY_ACTIONS.watches } })
    ).toStrictEqual({ kind: "watches" });
  });

  it("validates the watched widget target", () => {
    expect(
      trayActionOf({
        data: {
          action: TRAY_ACTIONS.openWatched,
          data: { watchId: "watch-1", widgetId: "w1" },
        },
      })
    ).toStrictEqual({
      kind: "open-watched",
      watchId: "watch-1",
      widgetId: "w1",
    });
    expect(
      trayActionOf({ data: { action: TRAY_ACTIONS.openWatched, data: {} } })
    ).toBeNull();
    expect(trayActionOf({ data: { action: "other" } })).toBeNull();
    expect(trayActionOf(null)).toBeNull();
  });
});
