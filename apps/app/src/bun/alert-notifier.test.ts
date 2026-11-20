import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAlertNotifier, NOTIFY_WINDOW_MS } from "./alert-notifier.ts";

const setup = () => {
  const show = vi.fn();
  const notifier = createAlertNotifier({
    clearTimer: (handle) => clearTimeout(handle),
    now: () => Date.now(),
    setTimer: (run, ms) => setTimeout(run, ms),
    show,
  });
  return { notifier, show };
};

const alert = (index: number) => ({
  body: `Alert ${index}`,
  subtitle: "analytics",
  title: "MRR",
});

describe("alert notifier", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-19T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows up to three notifications in ten minutes, not silent", () => {
    const { notifier, show } = setup();
    for (const index of [1, 2, 3]) {
      notifier.notify(alert(index));
    }
    expect(show).toHaveBeenCalledTimes(3);
    expect(show).toHaveBeenLastCalledWith({ ...alert(3), silent: false });
  });

  it("coalesces the overflow into one notification when the window frees", () => {
    const { notifier, show } = setup();
    for (const index of [1, 2, 3, 4, 5]) {
      notifier.notify(alert(index));
      vi.advanceTimersByTime(1000);
    }
    expect(show).toHaveBeenCalledTimes(3);

    vi.advanceTimersByTime(NOTIFY_WINDOW_MS);
    expect(show).toHaveBeenCalledTimes(4);
    expect(show).toHaveBeenLastCalledWith({
      body: "Open the menu bar to see them.",
      silent: false,
      title: "2 more alerts",
    });
  });

  it("keeps later alerts behind a pending summary so order holds", () => {
    const { notifier, show } = setup();
    for (const index of [1, 2, 3, 4]) {
      notifier.notify(alert(index));
    }
    vi.advanceTimersByTime(NOTIFY_WINDOW_MS - 1);
    notifier.notify(alert(5));
    expect(show).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(1);
    expect(show).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "2 more alerts" })
    );
  });

  it("shows again normally once the window has passed", () => {
    const { notifier, show } = setup();
    for (const index of [1, 2, 3]) {
      notifier.notify(alert(index));
    }
    vi.advanceTimersByTime(NOTIFY_WINDOW_MS);
    notifier.notify(alert(4));
    expect(show).toHaveBeenLastCalledWith({ ...alert(4), silent: false });
  });

  it("drops a pending summary on dispose", () => {
    const { notifier, show } = setup();
    for (const index of [1, 2, 3, 4]) {
      notifier.notify(alert(index));
    }
    notifier.dispose();
    vi.advanceTimersByTime(2 * NOTIFY_WINDOW_MS);
    expect(show).toHaveBeenCalledTimes(3);
  });
});
