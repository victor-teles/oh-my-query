import { DbError } from "./error.ts";

export class CancellationRegistry {
  readonly #controllers = new Map<string, AbortController>();

  register(queryId: string): AbortController {
    const existing = this.#controllers.get(queryId);
    if (existing) {
      existing.abort(DbError.cancelled());
    }
    const controller = new AbortController();
    this.#controllers.set(queryId, controller);
    return controller;
  }

  remove(queryId: string): void {
    this.#controllers.delete(queryId);
  }

  cancel(queryId: string): boolean {
    const controller = this.#controllers.get(queryId);
    if (!controller) {
      return false;
    }
    this.#controllers.delete(queryId);
    controller.abort(DbError.cancelled());
    return true;
  }
}

export interface RaceOptions {
  timeoutMs: number;
  signal: AbortSignal;
}

export async function raceWithCancel<T>(
  work: (signal: AbortSignal) => Promise<T>,
  opts: RaceOptions
): Promise<T> {
  const { timeoutMs, signal } = opts;
  const timeoutController = new AbortController();
  const timer = setTimeout(
    () => timeoutController.abort(DbError.timeout()),
    timeoutMs
  );

  const merged = new AbortController();
  const onAbort = (reason: unknown) => merged.abort(reason);
  signal.addEventListener("abort", () => onAbort(signal.reason), {
    once: true,
  });
  timeoutController.signal.addEventListener(
    "abort",
    () => onAbort(timeoutController.signal.reason),
    { once: true }
  );
  if (signal.aborted) {
    onAbort(signal.reason);
  }
  if (timeoutController.signal.aborted) {
    onAbort(timeoutController.signal.reason);
  }

  try {
    return await work(merged.signal);
  } finally {
    clearTimeout(timer);
  }
}
