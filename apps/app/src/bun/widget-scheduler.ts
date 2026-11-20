import type { Watch, WatchState } from "@conch/rpc";

import type { PowerSource } from "./watch-policy.ts";

import { effectiveIntervalMs, nextDueAt } from "./watch-policy.ts";

export const MIN_TICK_MS = 5000;
export const MAX_TICK_MS = 60_000;
export const WAKE_LATENESS_MS = 60_000;
export const WAKE_GRACE_MS = 20_000;
export const WAKE_SPACING_MS = 2000;
export const MAX_CONCURRENT_RUNS = 2;
export const CHANGE_THROTTLE_MS = 1000;

// These only change when the user edits a widget or a connection.
const TERMINAL_CODES = new Set(["WIDGET_NOT_FOUND", "CONNECTION_MISSING"]);

export type TimerHandle = ReturnType<typeof setTimeout>;

export interface WatchRunFailure {
  code: string;
  message: string;
}

export type WatchReport<O> =
  | { ok: true; outcome: O }
  | { ok: false; failure: WatchRunFailure };

export interface SchedulerPorts<O> {
  now(): number;
  setTimer(run: () => void, ms: number): TimerHandle;
  clearTimer(handle: TimerHandle): void;
  listWatches(): Promise<Watch[]>;
  lastSampleAt(watch: Watch): Promise<number | null>;
  connectionOf(watch: Watch): Promise<string | null>;
  isPaused(connectionId: string): boolean;
  power(): PowerSource;
  watchingPaused(): Promise<boolean>;
  run(watch: Watch, signal: AbortSignal): Promise<O>;
  report(watch: Watch, report: WatchReport<O>): Promise<void>;
  changed(): void;
}

export interface ScheduledStatus {
  watchId: string;
  state: WatchState;
  nextRunAt: number | null;
  error: WatchRunFailure | null;
  failures: number;
  lastAttemptAt: number | null;
}

interface Slot extends ScheduledStatus {
  blocked: boolean;
}

interface Candidate {
  watch: Watch;
  connectionId: string;
  dueAt: number;
}

const clampTick = (ms: number): number =>
  Math.min(MAX_TICK_MS, Math.max(MIN_TICK_MS, ms));

const failureOf = (error: unknown): WatchRunFailure => {
  const code =
    typeof error === "object" &&
    error !== null &&
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : "QUERY_FAILED";
  const message =
    error instanceof Error && error.message
      ? error.message
      : "The widget could not run.";
  return { code, message };
};

export const createWidgetScheduler = <O>(ports: SchedulerPorts<O>) => {
  const slots = new Map<string, Slot>();
  const inFlight = new Map<
    string,
    { controller: AbortController; connectionId: string }
  >();
  let timer: TimerHandle | null = null;
  let expectedAt: number | null = null;
  let throttle: TimerHandle | null = null;
  let changedWhileThrottled = false;
  let stopped = true;
  let ticking = false;
  let tickAgain = false;
  let resumeAt: number | null = null;
  let draining = false;

  const notifyChanged = () => {
    if (throttle !== null) {
      changedWhileThrottled = true;
      return;
    }
    ports.changed();
    throttle = ports.setTimer(() => {
      throttle = null;
      if (changedWhileThrottled) {
        changedWhileThrottled = false;
        notifyChanged();
      }
    }, CHANGE_THROTTLE_MS);
  };

  const slotFor = (watchId: string): Slot => {
    const existing = slots.get(watchId);
    if (existing) {
      return existing;
    }
    const slot: Slot = {
      blocked: false,
      error: null,
      failures: 0,
      lastAttemptAt: null,
      nextRunAt: null,
      state: "idle",
      watchId,
    };
    slots.set(watchId, slot);
    return slot;
  };

  const setSlot = (slot: Slot, next: Partial<Slot>) => {
    const changed = Object.entries(next).some(
      ([key, value]) => slot[key as keyof Slot] !== value
    );
    Object.assign(slot, next);
    if (changed) {
      notifyChanged();
    }
  };

  const arm = (ms: number) => {
    if (timer !== null) {
      ports.clearTimer(timer);
    }
    expectedAt = ports.now() + ms;
    timer = ports.setTimer(() => {
      timer = null;
      tick();
    }, ms);
  };

  const armWithin = (ms: number) => {
    if (
      timer === null ||
      expectedAt === null ||
      expectedAt > ports.now() + ms
    ) {
      arm(ms);
    }
  };

  const evaluate = async (now: number): Promise<Candidate[]> => {
    const [watches, globallyPaused] = await Promise.all([
      ports.listWatches(),
      ports.watchingPaused(),
    ]);
    const ids = new Set(watches.map((watch) => watch.id));
    for (const id of slots.keys()) {
      if (!ids.has(id) && !inFlight.has(id)) {
        slots.delete(id);
      }
    }
    const candidates: Candidate[] = [];
    for (const watch of watches) {
      const slot = slotFor(watch.id);
      if (inFlight.has(watch.id)) {
        continue;
      }
      if (globallyPaused || watch.paused) {
        setSlot(slot, { nextRunAt: null, state: "paused" });
        continue;
      }
      if (slot.blocked) {
        setSlot(slot, { nextRunAt: null, state: "error" });
        continue;
      }
      // oxlint-disable-next-line no-await-in-loop -- each lookup is a cheap store read
      const connectionId = await ports.connectionOf(watch);
      if (connectionId === null) {
        setSlot(slot, {
          blocked: true,
          error: {
            code: "WIDGET_NOT_FOUND",
            message: "This widget no longer exists.",
          },
          nextRunAt: null,
          state: "error",
        });
        continue;
      }
      if (ports.isPaused(connectionId)) {
        setSlot(slot, { nextRunAt: null, state: "paused" });
        continue;
      }
      // oxlint-disable-next-line no-await-in-loop -- each lookup is a cheap store read
      const lastSampleAt = await ports.lastSampleAt(watch);
      const dueAt = nextDueAt({
        failures: slot.failures,
        intervalMs: effectiveIntervalMs(watch.interval, ports.power()),
        lastAttemptAt: slot.lastAttemptAt,
        lastSampleAt,
        now,
      });
      setSlot(slot, {
        nextRunAt: Math.max(dueAt, resumeAt ?? dueAt),
        state: slot.error ? "error" : "idle",
      });
      if (dueAt <= now) {
        candidates.push({ connectionId, dueAt, watch });
      }
    }
    return candidates.toSorted((a, b) => a.dueAt - b.dueAt);
  };

  const finish = async (watch: Watch, slot: Slot, report: WatchReport<O>) => {
    if (stopped) {
      return;
    }
    try {
      await ports.report(watch, report);
    } catch (error) {
      console.error(`[watch] could not report ${watch.id}: ${String(error)}`);
    }
    setSlot(slot, { state: slot.error ? "error" : "idle" });
    if (!stopped && !ticking) {
      armWithin(MIN_TICK_MS);
    }
  };

  const start = async ({ watch, connectionId }: Candidate) => {
    const controller = new AbortController();
    inFlight.set(watch.id, { connectionId, controller });
    const slot = slotFor(watch.id);
    setSlot(slot, { lastAttemptAt: ports.now(), state: "running" });
    let report: WatchReport<O>;
    try {
      const outcome = await ports.run(watch, controller.signal);
      slot.failures = 0;
      slot.error = null;
      report = { ok: true, outcome };
    } catch (error) {
      const failure = failureOf(error);
      slot.failures += 1;
      slot.error = failure;
      slot.blocked = TERMINAL_CODES.has(failure.code);
      report = { failure, ok: false };
    } finally {
      inFlight.delete(watch.id);
    }
    await finish(watch, slot, report);
  };

  const dispatch = (candidates: readonly Candidate[]): number => {
    const busy = new Set([...inFlight.values()].map((run) => run.connectionId));
    let started = 0;
    for (const candidate of candidates) {
      const slot = slotFor(candidate.watch.id);
      const full =
        inFlight.size >= MAX_CONCURRENT_RUNS || (draining && started > 0);
      if (full || busy.has(candidate.connectionId)) {
        setSlot(slot, { state: "waiting" });
        continue;
      }
      busy.add(candidate.connectionId);
      started += 1;
      start(candidate);
    }
    return started;
  };

  const nextDelay = (): number => {
    if (draining) {
      return WAKE_SPACING_MS;
    }
    const now = ports.now();
    const upcoming = [...slots.values()]
      .map((slot) => slot.nextRunAt)
      .filter((at): at is number => at !== null);
    return clampTick(Math.min(...upcoming, now + MAX_TICK_MS) - now);
  };

  async function tick(): Promise<void> {
    if (stopped) {
      return;
    }
    if (ticking) {
      tickAgain = true;
      return;
    }
    ticking = true;
    const now = ports.now();
    if (expectedAt !== null && now - expectedAt > WAKE_LATENESS_MS) {
      resumeAt = now + WAKE_GRACE_MS;
      draining = true;
    }
    try {
      if (resumeAt !== null && now < resumeAt) {
        await evaluate(now);
        arm(resumeAt - now);
        return;
      }
      resumeAt = null;
      const candidates = await evaluate(now);
      const started = stopped ? 0 : dispatch(candidates);
      if (draining && candidates.length <= started) {
        draining = false;
      }
    } catch (error) {
      console.error(`[watch] scheduler tick failed: ${String(error)}`);
    } finally {
      ticking = false;
    }
    if (stopped) {
      return;
    }
    if (tickAgain) {
      tickAgain = false;
      arm(MIN_TICK_MS);
      return;
    }
    arm(nextDelay());
  }

  return {
    refresh(): void {
      for (const slot of slots.values()) {
        slot.blocked = false;
      }
      if (stopped) {
        return;
      }
      if (ticking) {
        tickAgain = true;
        return;
      }
      arm(MIN_TICK_MS);
    },

    start(): void {
      if (!stopped) {
        return;
      }
      stopped = false;
      arm(MIN_TICK_MS);
    },

    statuses(): ScheduledStatus[] {
      return [...slots.values()].map(
        ({ blocked: _blocked, ...status }) => status
      );
    },

    stop(): void {
      stopped = true;
      for (const run of inFlight.values()) {
        run.controller.abort();
      }
      for (const handle of [timer, throttle]) {
        if (handle !== null) {
          ports.clearTimer(handle);
        }
      }
      timer = null;
      throttle = null;
      expectedAt = null;
    },
  };
};

export type WidgetScheduler = ReturnType<typeof createWidgetScheduler>;
