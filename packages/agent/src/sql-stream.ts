export const SQL_DELTA_INTERVAL_MS = 32;

const OPENING_FENCE = /^```[^\n]*\n/;
const FENCE = "```";
const HELD_TAIL = /[\s`]*$/;
const CLOSING_FENCE = /\n[ \t]*`{1,3}\s*$|```\s*$/;

export interface FenceStripper {
  push(chunk: string): string;
  flush(): string;
}

// Holds back the opening fence until its newline arrives and any trailing
// whitespace or backticks until the stream ends, so a closing fence split
// across chunks never reaches the user.
export const createFenceStripper = (): FenceStripper => {
  let head: string | null = "";
  let tail = "";

  const releaseBody = (text: string): string => {
    const combined = tail + text;
    const heldFrom = HELD_TAIL.exec(combined)?.index ?? combined.length;
    tail = combined.slice(heldFrom);
    return combined.slice(0, heldFrom);
  };

  const resolveHead = (pending: string): string | null => {
    const trimmed = pending.trimStart();
    if (FENCE.startsWith(trimmed)) {
      return null;
    }
    if (!trimmed.startsWith(FENCE)) {
      return trimmed;
    }
    const opening = OPENING_FENCE.exec(trimmed);
    return opening ? trimmed.slice(opening[0].length) : null;
  };

  return {
    flush() {
      const released =
        head === null ? "" : releaseBody(resolveHead(head) ?? "");
      head = null;
      const rest = tail.replace(CLOSING_FENCE, "").trimEnd();
      tail = "";
      return released + rest;
    },
    push(chunk) {
      if (head === null) {
        return releaseBody(chunk);
      }
      head += chunk;
      const body = resolveHead(head);
      if (body === null) {
        return "";
      }
      head = null;
      return releaseBody(body.trimStart());
    },
  };
};

const TICK = Symbol("tick");

const wait = (ms: number) => {
  const { promise, resolve } = Promise.withResolvers<typeof TICK>();
  const timer = setTimeout(() => resolve(TICK), ms);
  return { cancel: () => clearTimeout(timer), promise };
};

// Emits at most one merged chunk per interval: the first chunk goes out at
// once, later chunks wait for the window to close (even if the source stalls).
export async function* coalesceText(
  source: AsyncIterable<string>,
  intervalMs = SQL_DELTA_INTERVAL_MS
): AsyncGenerator<string> {
  const iterator = source[Symbol.asyncIterator]();
  let buffer = "";
  let lastFlush = Number.NEGATIVE_INFINITY;
  let pending: Promise<IteratorResult<string>> | null = null;

  try {
    while (true) {
      pending ??= iterator.next();
      let next: IteratorResult<string> | typeof TICK;
      if (buffer) {
        const timer = wait(Math.max(0, lastFlush + intervalMs - Date.now()));
        next = await Promise.race([pending, timer.promise]);
        timer.cancel();
      } else {
        next = await pending;
      }

      if (next !== TICK) {
        pending = null;
        if (next.done) {
          break;
        }
        buffer += next.value;
        if (Date.now() - lastFlush < intervalMs) {
          continue;
        }
      }
      if (buffer) {
        yield buffer;
        buffer = "";
        lastFlush = Date.now();
      }
    }
    if (buffer) {
      yield buffer;
    }
  } finally {
    await iterator.return?.();
  }
}
