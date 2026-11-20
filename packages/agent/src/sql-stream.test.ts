import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { coalesceText, createFenceStripper } from "./sql-stream.ts";

const strip = (chunks: string[]): { emitted: string[]; text: string } => {
  const stripper = createFenceStripper();
  const emitted = chunks.map((chunk) => stripper.push(chunk));
  emitted.push(stripper.flush());
  return { emitted, text: emitted.join("") };
};

describe("createFenceStripper", () => {
  it("passes unfenced SQL through and trims the edges", () => {
    expect(strip(["  select 1", "\nfrom t  \n"]).text).toBe("select 1\nfrom t");
  });

  it("strips a fence split across every chunk boundary", () => {
    const { emitted, text } = strip([
      "`",
      "``s",
      "ql\nselect ",
      "id from t\n`",
      "``",
    ]);
    expect(text).toBe("select id from t");
    expect(emitted.join("")).not.toContain("`");
  });

  it("strips a fence without a language tag", () => {
    expect(strip(["```\nselect 1\n```\n"]).text).toBe("select 1");
  });

  it("never emits a partial closing fence before the stream ends", () => {
    const stripper = createFenceStripper();
    expect(stripper.push("```sql\nselect 1")).toBe("select 1");
    expect(stripper.push("\n``")).toBe("");
    expect(stripper.flush()).toBe("");
  });

  it("keeps backtick identifiers that end the statement", () => {
    expect(strip(["select * from `ord", "ers`"]).text).toBe(
      "select * from `orders`"
    );
  });

  it("releases held whitespace once more SQL arrives", () => {
    const stripper = createFenceStripper();
    expect(stripper.push("select 1\n")).toBe("select 1");
    expect(stripper.push("from t")).toBe("\nfrom t");
  });

  it("emits nothing for a bare fence", () => {
    expect(strip(["```sql"]).text).toBe("");
  });
});

const scripted = (steps: [number, string][]): AsyncIterable<string> => ({
  async *[Symbol.asyncIterator]() {
    for (const [delayMs, chunk] of steps) {
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, delayMs);
      await promise;
      yield chunk;
    }
  },
});

const gapsBetween = (messages: { at: number }[]): number[] =>
  messages
    .slice(1)
    .map((message, index) => message.at - (messages[index]?.at ?? 0));

const collect = async (
  source: AsyncIterable<string>
): Promise<{ at: number; text: string }[]> => {
  const out: { at: number; text: string }[] = [];
  const start = Date.now();
  for await (const text of source) {
    out.push({ at: Date.now() - start, text });
  }
  return out;
};

describe("coalesceText", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("merges a flood of tiny chunks into at most one message per 32ms", async () => {
    const steps: [number, string][] = Array.from({ length: 40 }, () => [
      2,
      "x",
    ]);
    const done = collect(coalesceText(scripted(steps)));
    await vi.runAllTimersAsync();
    const messages = await done;

    expect(messages.map((m) => m.text).join("")).toBe("x".repeat(40));
    expect(messages.length).toBeLessThanOrEqual(4);
    const pacedGaps = gapsBetween(messages.slice(0, -1));
    expect(Math.min(...pacedGaps)).toBeGreaterThanOrEqual(32);
  });

  it("emits the first chunk immediately", async () => {
    const done = collect(coalesceText(scripted([[0, "select"]])));
    await vi.runAllTimersAsync();
    await expect(done).resolves.toStrictEqual([{ at: 0, text: "select" }]);
  });

  it("flushes buffered text when the source stalls", async () => {
    const done = collect(
      coalesceText(
        scripted([
          [0, "a"],
          [5, "b"],
          [500, "c"],
        ])
      )
    );
    await vi.runAllTimersAsync();
    await expect(done).resolves.toStrictEqual([
      { at: 0, text: "a" },
      { at: 32, text: "b" },
      { at: 505, text: "c" },
    ]);
  });

  it("flushes the remainder when the source ends", async () => {
    const done = collect(
      coalesceText(
        scripted([
          [0, "a"],
          [1, "b"],
          [1, "c"],
        ])
      )
    );
    await vi.runAllTimersAsync();
    const messages = await done;
    expect(messages.map((m) => m.text)).toStrictEqual(["a", "bc"]);
  });
});
