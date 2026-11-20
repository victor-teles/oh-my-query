import type * as NodeOs from "node:os";

import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const TMP_HOME = mkdtempSync(path.join(os.tmpdir(), "conch-core-watches-"));

vi.mock<typeof NodeOs>(import("node:os"), async () => {
  const actual = await vi.importActual<typeof NodeOs>("node:os");
  return {
    ...actual,
    default: { ...actual, homedir: () => TMP_HOME },
    homedir: () => TMP_HOME,
  };
});

const { decryptLine, resetCryptoCache, setLegacyKeyLoader } =
  await import("./crypto.ts");
const { createRunLogStore, createWatchStore, runLogEntryId } =
  await import("./watches.ts");
const { runLogPath, watchesPath } = await import("./paths.ts");
const { appConfigDir } = await import("./test-utils.ts");

interface TestWatch {
  id: string;
  widgetId: string;
  interval: string;
}

interface TestSample {
  at: string;
  value: number;
}

interface TestEntry {
  id: string;
  widgetId: string;
  valuesKey: string;
  samples: TestSample[];
}

const parseWatch = (raw: unknown): TestWatch | null => {
  const value = raw as Partial<TestWatch>;
  return typeof value.interval === "string" &&
    typeof value.widgetId === "string"
    ? {
        id: String(value.id),
        interval: value.interval,
        widgetId: value.widgetId,
      }
    : null;
};

const parseEntry = (raw: unknown): TestEntry | null => {
  const value = raw as Partial<TestEntry>;
  return Array.isArray(value.samples) ? (value as TestEntry) : null;
};

// oxlint-disable-next-line require-await -- placeholder loader for tests
const noLegacyKey = async (): Promise<string | null> => null;

const watches = createWatchStore(parseWatch);
const runLog = createRunLogStore(parseEntry, {
  maxEntriesPerWidget: 8,
  maxSamples: 30,
});

const at = (minute: number) =>
  new Date(Date.UTC(2026, 10, 19, 9, minute)).toISOString();

const reset = async () => {
  resetCryptoCache();
  setLegacyKeyLoader(noLegacyKey);
  await fs.rm(appConfigDir(TMP_HOME), { force: true, recursive: true });
};

describe("watch store", () => {
  beforeEach(reset);

  it("creates, reads, updates and removes watches", async () => {
    await expect(watches.list()).resolves.toStrictEqual([]);
    await watches.save({ id: "a", interval: "5m", widgetId: "w1" });
    await watches.save({ id: "b", interval: "1h", widgetId: "w2" });
    await watches.update("a", (watch) => ({ ...watch, interval: "1m" }));

    await expect(watches.get("a")).resolves.toStrictEqual({
      id: "a",
      interval: "1m",
      widgetId: "w1",
    });
    await watches.remove("b");
    await expect(watches.list()).resolves.toHaveLength(1);
  });

  it("removes every watch of a deleted widget", async () => {
    await watches.save({ id: "a", interval: "5m", widgetId: "w1" });
    await watches.save({ id: "b", interval: "5m", widgetId: "w1" });
    await watches.save({ id: "c", interval: "5m", widgetId: "w2" });
    await watches.removeForWidget("w1");
    await expect(watches.list()).resolves.toStrictEqual([
      { id: "c", interval: "5m", widgetId: "w2" },
    ]);
  });

  it("encrypts watches on disk", async () => {
    await watches.save({ id: "a", interval: "5m", widgetId: "secret-widget" });
    const raw = await fs.readFile(watchesPath(), "utf8");
    expect(raw).not.toContain("secret-widget");
    expect(JSON.parse(await decryptLine(raw.trim()))).toHaveLength(1);
  });

  it("sets a corrupt file aside and starts empty", async () => {
    await fs.mkdir(path.dirname(watchesPath()), { recursive: true });
    await fs.writeFile(watchesPath(), "not-encrypted-garbage");
    const warn = vi.spyOn(console, "warn").mockReturnValue();

    await expect(watches.list()).resolves.toStrictEqual([]);
    const files = await fs.readdir(path.dirname(watchesPath()));
    expect(
      files.some((name) => name.startsWith("watches.enc.corrupt-"))
    ).toBeTruthy();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

describe("run log store", () => {
  beforeEach(reset);

  afterAll(async () => {
    await fs.rm(TMP_HOME, { force: true, recursive: true });
  });

  it("appends samples newest last and returns the updated entry", async () => {
    await runLog.append("w1", "k1", { at: at(1), value: 1 });
    const entry = await runLog.append("w1", "k1", { at: at(2), value: 2 });

    expect(entry).toStrictEqual({
      id: runLogEntryId("w1", "k1"),
      samples: [
        { at: at(1), value: 1 },
        { at: at(2), value: 2 },
      ],
      valuesKey: "k1",
      widgetId: "w1",
    });
    await expect(runLog.entry("w1", "k1")).resolves.toStrictEqual(entry);
    await expect(runLog.entry("w1", "other")).resolves.toBeNull();
  });

  it("keeps the newest 30 samples per entry", async () => {
    for (let minute = 0; minute < 35; minute += 1) {
      // oxlint-disable-next-line no-await-in-loop -- appends are ordered
      await runLog.append("w1", "k1", { at: at(minute), value: minute });
    }
    const entry = await runLog.entry("w1", "k1");
    expect(entry?.samples).toHaveLength(30);
    expect(entry?.samples.at(0)?.value).toBe(5);
    expect(entry?.samples.at(-1)?.value).toBe(34);
  });

  it("keeps at most 8 entries per widget, evicting the least recently sampled", async () => {
    for (let index = 0; index < 9; index += 1) {
      // oxlint-disable-next-line no-await-in-loop -- appends are ordered
      await runLog.append("w1", `k${index}`, { at: at(index), value: index });
    }
    await runLog.append("w2", "k0", { at: at(0), value: 0 });

    await expect(runLog.entry("w1", "k0")).resolves.toBeNull();
    await expect(runLog.entry("w1", "k8")).resolves.not.toBeNull();
    await expect(runLog.entry("w2", "k0")).resolves.not.toBeNull();
  });

  it("finds each widget's most recently sampled entry", async () => {
    await runLog.append("w1", "old", { at: at(1), value: 1 });
    await runLog.append("w1", "new", { at: at(5), value: 5 });
    await runLog.append("w2", "only", { at: at(3), value: 3 });
    await runLog.append("w3", "skip", { at: at(3), value: 3 });

    const latest = await runLog.latestFor(["w1", "w2", "missing"]);
    expect(Object.keys(latest).toSorted()).toStrictEqual(["w1", "w2"]);
    expect(latest.w1?.valuesKey).toBe("new");
  });

  it("removes a widget's run log", async () => {
    await runLog.append("w1", "k1", { at: at(1), value: 1 });
    await runLog.append("w2", "k1", { at: at(1), value: 1 });
    await runLog.removeForWidget("w1");
    await expect(runLog.latestFor(["w1", "w2"])).resolves.toHaveProperty("w2");
    await expect(runLog.entry("w1", "k1")).resolves.toBeNull();
    const raw = await fs.readFile(runLogPath(), "utf8");
    expect(JSON.parse(await decryptLine(raw.trim()))).toHaveLength(1);
  });
});
