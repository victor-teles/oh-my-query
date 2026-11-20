import type {
  AlertState,
  RunSample,
  WatchCondition,
  WatchInterval,
} from "@conch/rpc";

import { WATCH_INTERVAL_MS } from "@conch/rpc";

export type PowerSource = "ac" | "battery";

const MINUTE_MS = 60_000;
export const BATTERY_FLOOR_MS = 15 * MINUTE_MS;
export const MAX_BACKOFF_MS = 60 * MINUTE_MS;
export const ALERT_COOLDOWN_MS = 60 * MINUTE_MS;
export const REARM_AFTER_FALSE = 2;

export const effectiveIntervalMs = (
  interval: WatchInterval,
  power: PowerSource
): number => {
  const base = WATCH_INTERVAL_MS[interval];
  return power === "battery" ? Math.max(base, BATTERY_FLOOR_MS) : base;
};

interface DueInput {
  lastSampleAt: number | null;
  lastAttemptAt: number | null;
  intervalMs: number;
  failures: number;
  now: number;
}

export const nextDueAt = ({
  lastSampleAt,
  lastAttemptAt,
  intervalMs,
  failures,
  now,
}: DueInput): number => {
  if (failures > 0 && lastAttemptAt !== null) {
    return lastAttemptAt + Math.min(intervalMs * 2 ** failures, MAX_BACKOFF_MS);
  }
  return lastSampleAt === null ? now : lastSampleAt + intervalMs;
};

const conditionHolds = (
  condition: WatchCondition,
  previous: RunSample | null,
  sample: RunSample
): boolean | null => {
  switch (condition.kind) {
    case "below": {
      return sample.value === null ? null : sample.value < condition.threshold;
    }
    case "above": {
      return sample.value === null ? null : sample.value > condition.threshold;
    }
    case "hasRows": {
      return sample.rowCount > 0;
    }
    default: {
      return previous !== null && previous.digest !== sample.digest;
    }
  }
};

const coolingDown = (state: AlertState, now: Date): boolean =>
  state.lastFiredAt !== null &&
  now.getTime() - Date.parse(state.lastFiredAt) < ALERT_COOLDOWN_MS;

export interface AlertEvaluation {
  fire: boolean;
  next: AlertState;
}

// Fires once per crossing: a threshold alert re-arms only after two false
// evaluations in a row, and no watch fires twice within the cooldown.
export const evaluateAlert = (
  condition: WatchCondition,
  previous: RunSample | null,
  sample: RunSample,
  state: AlertState,
  now: Date
): AlertEvaluation => {
  const holds = conditionHolds(condition, previous, sample);
  if (holds === null) {
    return { fire: false, next: state };
  }
  if (condition.kind === "changed" && !state.armed) {
    return { fire: false, next: { ...state, armed: true } };
  }
  if (holds) {
    if (state.armed && !coolingDown(state, now)) {
      return {
        fire: true,
        next: {
          ...state,
          armed: false,
          falseStreak: 0,
          lastFiredAt: now.toISOString(),
        },
      };
    }
    return {
      fire: false,
      next: state.falseStreak === 0 ? state : { ...state, falseStreak: 0 },
    };
  }
  if (state.armed) {
    return { fire: false, next: state };
  }
  const falseStreak = state.falseStreak + 1;
  return {
    fire: false,
    next:
      falseStreak >= REARM_AFTER_FALSE
        ? { ...state, armed: true, falseStreak: 0 }
        : { ...state, falseStreak },
  };
};

export interface AlertMessageInput {
  widgetName: string;
  condition: WatchCondition;
  display: string | null;
  thresholdDisplay: string | null;
  rowCount: number;
}

export interface NotificationText {
  title: string;
  body: string;
}

const rowsMatch = (count: number): string =>
  count === 1 ? "1 row matches now." : `${count} rows match now.`;

export const alertMessage = ({
  widgetName,
  condition,
  display,
  thresholdDisplay,
  rowCount,
}: AlertMessageInput): NotificationText => {
  switch (condition.kind) {
    case "below":
    case "above": {
      return {
        body: `${widgetName} is ${display ?? "—"}, ${condition.kind} ${thresholdDisplay ?? condition.threshold}.`,
        title: widgetName,
      };
    }
    case "hasRows": {
      return { body: rowsMatch(rowCount), title: widgetName };
    }
    default: {
      return { body: "The result changed.", title: widgetName };
    }
  }
};

export const failureMessage = (widgetName: string): NotificationText => ({
  body: "It failed three times in a row. Open the menu bar to see why.",
  title: `Couldn't check ${widgetName}`,
});
