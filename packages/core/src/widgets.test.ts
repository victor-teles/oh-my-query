import type * as NodeOs from "node:os";

import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const TMP_HOME = mkdtempSync(path.join(os.tmpdir(), "conch-core-widgets-"));

vi.mock<typeof NodeOs>(import("node:os"), async () => {
  const actual = await vi.importActual<typeof NodeOs>("node:os");
  return {
    ...actual,
    default: { ...actual, homedir: () => TMP_HOME },
    homedir: () => TMP_HOME,
  };
});

const { decryptLine, encryptLine, resetCryptoCache, setLegacyKeyLoader } =
  await import("./crypto.ts");
const { createRecentAskStore, createWidgetStore, MAX_RECENT_ASKS } =
  await import("./widgets.ts");
const { recentAsksPath, widgetsPath } = await import("./paths.ts");
const { appConfigDir } = await import("./test-utils.ts");

interface TestWidget {
  id: string;
  name: string;
}

interface TestAsk {
  id: string;
  prompt: string;
  connectionId: string;
}

const parseWidget = (raw: unknown): TestWidget | null => {
  const value = raw as Partial<TestWidget>;
  return typeof value.name === "string"
    ? { id: String(value.id), name: value.name }
    : null;
};

const parseAsk = (raw: unknown): TestAsk | null => raw as TestAsk;

// oxlint-disable-next-line require-await -- placeholder loader for tests
const noLegacyKey = async (): Promise<string | null> => null;

const widgets = createWidgetStore(parseWidget);
const recents = createRecentAskStore(parseAsk);

describe("widget store", () => {
  beforeEach(async () => {
    resetCryptoCache();
    setLegacyKeyLoader(noLegacyKey);
    await fs.rm(appConfigDir(TMP_HOME), { force: true, recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TMP_HOME, { force: true, recursive: true });
  });

  it("lists nothing before the first save", async () => {
    await expect(widgets.listWidgets()).resolves.toStrictEqual([]);
    await expect(widgets.getWidget("w1")).resolves.toBeNull();
  });

  it("creates, updates in place, and deletes", async () => {
    await widgets.saveWidget({ id: "w1", name: "Revenue" });
    await widgets.saveWidget({ id: "w2", name: "Signups" });
    await widgets.saveWidget({ id: "w1", name: "Revenue by region" });

    await expect(widgets.listWidgets()).resolves.toStrictEqual([
      { id: "w1", name: "Revenue by region" },
      { id: "w2", name: "Signups" },
    ]);
    await expect(widgets.getWidget("w2")).resolves.toStrictEqual({
      id: "w2",
      name: "Signups",
    });

    await widgets.deleteWidget("w1");
    await expect(widgets.listWidgets()).resolves.toStrictEqual([
      { id: "w2", name: "Signups" },
    ]);
  });

  it("updates one widget inside the lock and leaves the rest", async () => {
    await widgets.saveWidget({ id: "w1", name: "Revenue" });
    await widgets.saveWidget({ id: "w2", name: "Signups" });

    const updated = await widgets.updateWidget("w1", (widget) => ({
      ...widget,
      name: `${widget.name} by region`,
    }));

    expect(updated).toStrictEqual({ id: "w1", name: "Revenue by region" });
    await expect(widgets.listWidgets()).resolves.toStrictEqual([
      { id: "w1", name: "Revenue by region" },
      { id: "w2", name: "Signups" },
    ]);
    await expect(
      widgets.updateWidget("missing", (widget) => widget)
    ).resolves.toBeNull();
  });

  it("encrypts the file on disk", async () => {
    await widgets.saveWidget({ id: "w1", name: "Secret revenue" });
    const raw = await fs.readFile(widgetsPath(), "utf8");
    expect(raw).not.toContain("Secret revenue");
    expect(JSON.parse(await decryptLine(raw.trim()))).toStrictEqual([
      { id: "w1", name: "Secret revenue" },
    ]);
  });

  it("serializes concurrent saves so none is lost", async () => {
    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        widgets.saveWidget({ id: `w${index}`, name: `Widget ${index}` })
      )
    );
    await expect(widgets.listWidgets()).resolves.toHaveLength(8);
  });

  it("keeps records it can't parse when writing others", async () => {
    await fs.mkdir(path.dirname(widgetsPath()), { recursive: true });
    await fs.writeFile(
      widgetsPath(),
      await encryptLine(JSON.stringify([{ future: true, id: "w9" }]))
    );
    await widgets.saveWidget({ id: "w1", name: "Revenue" });

    await expect(widgets.listWidgets()).resolves.toStrictEqual([
      { id: "w1", name: "Revenue" },
    ]);
    const raw = await fs.readFile(widgetsPath(), "utf8");
    expect(JSON.parse(await decryptLine(raw.trim()))).toHaveLength(2);
  });

  it("sets a corrupt file aside and starts empty", async () => {
    await fs.mkdir(path.dirname(widgetsPath()), { recursive: true });
    await fs.writeFile(widgetsPath(), "not-encrypted-garbage");
    const warn = vi.spyOn(console, "warn").mockReturnValue();

    await expect(widgets.listWidgets()).resolves.toStrictEqual([]);
    await widgets.saveWidget({ id: "w1", name: "Revenue" });

    const files = await fs.readdir(path.dirname(widgetsPath()));
    expect(
      files.some((name) => name.startsWith("widgets.enc.corrupt-"))
    ).toBeTruthy();
    await expect(widgets.listWidgets()).resolves.toHaveLength(1);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

describe("recent ask store", () => {
  beforeEach(async () => {
    resetCryptoCache();
    setLegacyKeyLoader(noLegacyKey);
    await fs.rm(appConfigDir(TMP_HOME), { force: true, recursive: true });
  });

  it("puts the newest ask first and drops an earlier copy of the same question", async () => {
    await recents.pushRecentAsk({
      connectionId: "c1",
      id: "a1",
      prompt: "MRR",
    });
    await recents.pushRecentAsk({
      connectionId: "c1",
      id: "a2",
      prompt: "signups",
    });
    await recents.pushRecentAsk({
      connectionId: "c1",
      id: "a3",
      prompt: " mrr ",
    });
    await recents.pushRecentAsk({
      connectionId: "c2",
      id: "a4",
      prompt: "MRR",
    });

    const asks = await recents.listRecentAsks();
    const ids = asks.map((ask) => ask.id);
    expect(ids).toStrictEqual(["a4", "a3", "a2"]);
  });

  it("replaces the entry of a refined chain that keeps its id", async () => {
    await recents.pushRecentAsk({
      connectionId: "c1",
      id: "chain",
      prompt: "MRR",
    });
    await recents.pushRecentAsk({
      connectionId: "c1",
      id: "a2",
      prompt: "signups",
    });
    await recents.pushRecentAsk({
      connectionId: "c1",
      id: "chain",
      prompt: "MRR · only Europe",
    });

    const asks = await recents.listRecentAsks();
    expect(asks.map(({ id, prompt }) => `${id}:${prompt}`)).toStrictEqual([
      "chain:MRR · only Europe",
      "a2:signups",
    ]);
  });

  it("keeps the last 200", async () => {
    expect(MAX_RECENT_ASKS).toBe(200);
    for (let index = 0; index < MAX_RECENT_ASKS + 5; index += 1) {
      await recents.pushRecentAsk({
        connectionId: "c1",
        id: `a${index}`,
        prompt: `question ${index}`,
      });
    }
    const asks = await recents.listRecentAsks();
    expect(asks).toHaveLength(MAX_RECENT_ASKS);
    expect(asks[0]?.id).toBe(`a${MAX_RECENT_ASKS + 4}`);
  });

  it("lists only the newest asks up to a limit", async () => {
    for (const id of ["a1", "a2", "a3"]) {
      await recents.pushRecentAsk({ connectionId: "c1", id, prompt: id });
    }
    const ids = async (limit?: number) => {
      const asks = await recents.listRecentAsks(limit);
      return asks.map((ask) => ask.id);
    };
    await expect(ids(2)).resolves.toStrictEqual(["a3", "a2"]);
    await expect(ids(10)).resolves.toStrictEqual(["a3", "a2", "a1"]);
    await expect(ids()).resolves.toStrictEqual(["a3", "a2", "a1"]);
  });

  it("removes one ask and clears the rest", async () => {
    for (const id of ["a1", "a2", "a3"]) {
      await recents.pushRecentAsk({ connectionId: "c1", id, prompt: id });
    }
    await recents.removeRecentAsk("a2");
    await expect(recents.listRecentAsks()).resolves.toStrictEqual([
      { connectionId: "c1", id: "a3", prompt: "a3" },
      { connectionId: "c1", id: "a1", prompt: "a1" },
    ]);

    await recents.clearRecentAsks();
    await expect(recents.listRecentAsks()).resolves.toStrictEqual([]);
    const raw = await fs.readFile(recentAsksPath(), "utf8");
    expect(JSON.parse(await decryptLine(raw.trim()))).toStrictEqual([]);
  });

  it("encrypts recents on disk", async () => {
    await recents.pushRecentAsk({
      connectionId: "c1",
      id: "a1",
      prompt: "churned accounts",
    });
    const raw = await fs.readFile(recentAsksPath(), "utf8");
    expect(raw).not.toContain("churned");
  });
});
