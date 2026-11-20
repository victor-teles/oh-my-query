import type { TimerHandle } from "./widget-scheduler.ts";

export interface Notification {
  title: string;
  body: string;
  subtitle?: string;
}

export interface AlertNotifierDeps {
  show(notification: Notification & { silent: boolean }): void;
  now(): number;
  setTimer(run: () => void, ms: number): TimerHandle;
  clearTimer(handle: TimerHandle): void;
}

export const NOTIFY_WINDOW_MS = 10 * 60_000;
export const MAX_PER_WINDOW = 3;

const overflowText = (count: number): Notification => ({
  body: "Open the menu bar to see them.",
  title: count === 1 ? "1 more alert" : `${count} more alerts`,
});

// Never more than three notifications in any ten minutes; the rest are
// summed up in one notification when the window frees a slot.
export const createAlertNotifier = (deps: AlertNotifierDeps) => {
  let shown: number[] = [];
  let overflow = 0;
  let flushTimer: TimerHandle | null = null;

  const inWindow = (now: number) =>
    shown.filter((at) => now - at < NOTIFY_WINDOW_MS);

  const post = (notification: Notification) => {
    shown.push(deps.now());
    deps.show({ ...notification, silent: false });
  };

  const flush = () => {
    flushTimer = null;
    shown = inWindow(deps.now());
    if (overflow === 0) {
      return;
    }
    if (shown.length >= MAX_PER_WINDOW) {
      scheduleFlush();
      return;
    }
    const count = overflow;
    overflow = 0;
    post(overflowText(count));
  };

  const scheduleFlush = () => {
    if (flushTimer !== null) {
      return;
    }
    const [oldest] = shown;
    const wait =
      oldest === undefined ? 0 : oldest + NOTIFY_WINDOW_MS - deps.now();
    flushTimer = deps.setTimer(flush, Math.max(0, wait));
  };

  return {
    dispose() {
      if (flushTimer !== null) {
        deps.clearTimer(flushTimer);
        flushTimer = null;
      }
    },
    notify(notification: Notification) {
      shown = inWindow(deps.now());
      if (shown.length < MAX_PER_WINDOW && overflow === 0) {
        post(notification);
        return;
      }
      overflow += 1;
      scheduleFlush();
    },
  };
};

export type AlertNotifier = ReturnType<typeof createAlertNotifier>;
