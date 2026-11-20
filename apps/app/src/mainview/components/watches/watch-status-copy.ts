import { intervalPhrase, shortIntervalPhrase } from "@conch/rpc";

import type { Watch, WatchStatus } from "@/lib/ipc";

import { clockTime } from "./trend-delta";

const capitalized = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1);

export const watchingSentence = (
  widgetName: string,
  watch: Pick<Watch, "interval">
) => `Watching ${widgetName} ${intervalPhrase(watch.interval)}`;

export const savedLine = (watch: Pick<Watch, "interval">): string =>
  `Watching · ${shortIntervalPhrase(watch.interval)}`;

export const statusLine = (
  watch: Pick<Watch, "interval" | "paused">,
  status?: WatchStatus,
  globallyPaused = false
): string => {
  if (watch.paused || globallyPaused || status?.state === "paused") {
    return "Paused";
  }
  if (status?.state === "running") {
    return "Running…";
  }
  if (status?.error) {
    return `Couldn't refresh: ${status.error.message}`;
  }
  const every = capitalized(shortIntervalPhrase(watch.interval));
  return status?.nextRunAt
    ? `${every} · next ${clockTime(status.nextRunAt)}`
    : every;
};
