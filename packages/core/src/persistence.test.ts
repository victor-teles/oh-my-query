import type * as NodeOs from "node:os";

import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const TMP_HOME = mkdtempSync(path.join(os.tmpdir(), "omq-core-persistence-"));

vi.mock<typeof NodeOs>("node:os", async () => {
  const actual = await vi.importActual<typeof NodeOs>("node:os");
  return {
    ...actual,
    default: { ...actual, homedir: () => TMP_HOME },
    homedir: () => TMP_HOME,
  };
});

const { encryptLine, resetCryptoCache, setLegacyKeyLoader } =
  await import("./crypto.ts");

// oxlint-disable-next-line require-await -- placeholder loader for tests
const noLegacyKey = async (): Promise<string | null> => null;
const {
  appendHistory,
  getAllHistory,
  getConnections,
  getHistory,
  getTabs,
  resetSecrets,
  saveConnections,
  saveTabs,
} = await import("./persistence.ts");
const { connectionsPath, historyDir, historyPath, keyPath, tabsPath } =
  await import("./paths.ts");
const { appConfigDir, makeConnection, makeHistoryEntry } =
  await import("./test-utils.ts");

describe("persistence — tabs", () => {
  beforeEach(async () => {
    resetCryptoCache();
    setLegacyKeyLoader(noLegacyKey);
    await fs.rm(appConfigDir(TMP_HOME), { force: true, recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TMP_HOME, { force: true, recursive: true });
  });

  it("returns null when no tabs file exists", async () => {
    await expect(getTabs("c1")).resolves.toBeNull();
  });

  it("round-trips tabs state", async () => {
    const state = {
      activeTabId: "t1",
      counter: 1,
      tabs: [{ id: "t1", sourceDialect: null, sql: "SELECT 1", title: "Q1" }],
    };
    await saveTabs("c1", state);
    await expect(getTabs("c1")).resolves.toStrictEqual(state);
  });

  it("creates parent directories when saving", async () => {
    await fs.rm(appConfigDir(TMP_HOME), { force: true, recursive: true });
    await saveTabs("c1", { activeTabId: "", counter: 0, tabs: [] });
    const stat = await fs.stat(tabsPath("c1"));
    expect(stat.isFile()).toBeTruthy();
  });
});

describe("persistence — history append/read", () => {
  beforeEach(async () => {
    resetCryptoCache();
    setLegacyKeyLoader(noLegacyKey);
    await fs.rm(appConfigDir(TMP_HOME), { force: true, recursive: true });
  });

  it("appendHistory writes encrypted bytes (raw file lacks plaintext SQL)", async () => {
    const entry = makeHistoryEntry({ sql: "SELECT secret_password FROM auth" });
    await appendHistory(entry);
    const raw = await fs.readFile(historyPath(entry.connectionId), "utf8");
    expect(raw).not.toContain("secret_password");
  });

  it("getHistory returns decrypted entries newest-first", async () => {
    await appendHistory(
      makeHistoryEntry({
        sql: "first",
        timestamp: "2025-01-01T00:00:00Z",
      })
    );
    await appendHistory(
      makeHistoryEntry({
        sql: "second",
        timestamp: "2025-01-02T00:00:00Z",
      })
    );
    const history = await getHistory("c1");
    expect(history.map((h) => h.sql)).toStrictEqual(["second", "first"]);
  });

  it("getHistory honors limit and offset", async () => {
    for (let i = 0; i < 5; i += 1) {
      await appendHistory(
        makeHistoryEntry({
          sql: `q${i}`,
          timestamp: `2025-01-0${i + 1}T00:00:00Z`,
        })
      );
    }
    const page = await getHistory("c1", 2, 1);
    expect(page.map((h) => h.sql)).toStrictEqual(["q3", "q2"]);
  });

  it("returns [] when no history file exists", async () => {
    await expect(getHistory("missing")).resolves.toStrictEqual([]);
  });

  it("serializes 20 concurrent appendHistory calls without torn writes", async () => {
    const entries = Array.from({ length: 20 }, (_, i) =>
      makeHistoryEntry({ sql: `q-${i}`, timestamp: `2025-01-01T00:00:${i}Z` })
    );
    await Promise.all(entries.map((e) => appendHistory(e)));
    const history = await getHistory("c1", 100);
    const sqlSet = new Set(history.map((h) => h.sql));
    expect(sqlSet.size).toBe(20);
    for (let i = 0; i < 20; i += 1) {
      expect(sqlSet.has(`q-${i}`)).toBeTruthy();
    }
  });
});

describe("persistence — history migration", () => {
  beforeEach(async () => {
    resetCryptoCache();
    setLegacyKeyLoader(noLegacyKey);
    await fs.rm(appConfigDir(TMP_HOME), { force: true, recursive: true });
  });

  it("migrates plaintext history lines to encrypted on read", async () => {
    const plain = [
      makeHistoryEntry({ sql: "p1", timestamp: "2025-01-01T00:00:00Z" }),
      makeHistoryEntry({ sql: "p2", timestamp: "2025-01-02T00:00:00Z" }),
    ];
    await fs.mkdir(historyDir(), { recursive: true });
    await fs.writeFile(
      historyPath("c1"),
      `${plain.map((e) => JSON.stringify(e)).join("\n")}\n`
    );

    const history = await getHistory("c1");
    expect(history.map((h) => h.sql)).toStrictEqual(["p2", "p1"]);

    const raw = await fs.readFile(historyPath("c1"), "utf8");
    expect(raw.startsWith("{")).toBeFalsy();
    expect(raw).not.toContain("p1");
  });
});

describe("persistence — getAllHistory", () => {
  beforeEach(async () => {
    resetCryptoCache();
    setLegacyKeyLoader(noLegacyKey);
    await fs.rm(appConfigDir(TMP_HOME), { force: true, recursive: true });
    await appendHistory(
      makeHistoryEntry({
        connectionId: "c1",
        dialect: "postgresql",
        executionTimeMs: 100,
        sql: "SELECT 1 FROM a",
        success: true,
        timestamp: "2025-01-01T00:00:00Z",
      })
    );
    await appendHistory(
      makeHistoryEntry({
        connectionId: "c1",
        dialect: "postgresql",
        error: "boom",
        executionTimeMs: 500,
        sql: "SELECT 2 FROM a",
        success: false,
        timestamp: "2025-01-02T00:00:00Z",
      })
    );
    await appendHistory(
      makeHistoryEntry({
        connectionId: "c2",
        dialect: "mysql",
        executionTimeMs: 200,
        sql: "SELECT 3 FROM b",
        success: true,
        timestamp: "2025-01-03T00:00:00Z",
      })
    );
  });

  it("returns entries sorted DESC by timestamp across all connection files", async () => {
    const all = await getAllHistory();
    expect(all.map((e) => e.timestamp)).toStrictEqual([
      "2025-01-03T00:00:00Z",
      "2025-01-02T00:00:00Z",
      "2025-01-01T00:00:00Z",
    ]);
  });

  it("filters by connectionIds", async () => {
    const filtered = await getAllHistory({ connectionIds: ["c1"] });
    expect(filtered).toHaveLength(2);
    expect(filtered.every((e) => e.connectionId === "c1")).toBeTruthy();
  });

  it("filters by dialect", async () => {
    const filtered = await getAllHistory({ dialects: ["mysql"] });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.dialect).toBe("mysql");
  });

  it("filters by runtime range", async () => {
    const filtered = await getAllHistory({
      maxRuntimeMs: 400,
      minRuntimeMs: 150,
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.executionTimeMs).toBe(200);
  });

  it("filters errored only", async () => {
    const filtered = await getAllHistory({ erroredOnly: true });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.success).toBeFalsy();
  });

  it("filters by query substring (case-insensitive)", async () => {
    const filtered = await getAllHistory({ query: "from b" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.sql).toContain("FROM b");
  });

  it("paginates with offset and limit", async () => {
    const page = await getAllHistory({ limit: 1, offset: 1 });
    expect(page).toHaveLength(1);
    expect(page[0]?.timestamp).toBe("2025-01-02T00:00:00Z");
  });
});

describe("persistence — history trim boundary", () => {
  beforeEach(async () => {
    resetCryptoCache();
    setLegacyKeyLoader(noLegacyKey);
    await fs.rm(appConfigDir(TMP_HOME), { force: true, recursive: true });
  });

  it("trims history file to MAX_HISTORY_ENTRIES (10000) after append", async () => {
    await fs.mkdir(historyDir(), { recursive: true });
    const filePath = historyPath("c1");
    const lines: string[] = [];
    for (let i = 0; i < 10_001; i += 1) {
      const enc = await encryptLine(
        JSON.stringify(
          makeHistoryEntry({
            sql: `seed-${i}`,
            timestamp: `2025-01-01T00:00:${(i % 60).toString().padStart(2, "0")}Z`,
          })
        )
      );
      lines.push(enc);
    }
    await fs.writeFile(filePath, `${lines.join("\n")}\n`);

    await appendHistory(
      makeHistoryEntry({ sql: "newest", timestamp: "2025-12-31T00:00:00Z" })
    );

    const raw = await fs.readFile(filePath, "utf8");
    const dataLines = raw.replace(/\n$/, "").split("\n");
    expect(dataLines).toHaveLength(10_000);
  }, 30_000);
});

describe("persistence — connections", () => {
  beforeEach(async () => {
    resetCryptoCache();
    setLegacyKeyLoader(noLegacyKey);
    await fs.rm(appConfigDir(TMP_HOME), { force: true, recursive: true });
  });

  it("returns [] when no connections file exists", async () => {
    await expect(getConnections()).resolves.toStrictEqual([]);
  });

  it("round-trips connections with encrypted on-disk format", async () => {
    const conns = [makeConnection({ password: "supersecret123" })];
    await saveConnections(conns);
    await expect(getConnections()).resolves.toStrictEqual(conns);
    const raw = await fs.readFile(connectionsPath(), "utf8");
    expect(raw).not.toContain("supersecret123");
  });

  it("migrates a plaintext connections file to encrypted on read", async () => {
    const conns = [makeConnection({ password: "plaintext-pwd" })];
    await fs.mkdir(appConfigDir(TMP_HOME), { recursive: true });
    await fs.writeFile(connectionsPath(), JSON.stringify(conns));

    await expect(getConnections()).resolves.toStrictEqual(conns);

    const raw = await fs.readFile(connectionsPath(), "utf8");
    expect(raw.startsWith("[")).toBeFalsy();
    expect(raw).not.toContain("plaintext-pwd");
  });
});

describe("persistence — resetSecrets", () => {
  beforeEach(async () => {
    resetCryptoCache();
    setLegacyKeyLoader(noLegacyKey);
    await fs.rm(appConfigDir(TMP_HOME), { force: true, recursive: true });
  });

  it("removes the key, connections file, and history directory", async () => {
    await saveConnections([makeConnection()]);
    await appendHistory(makeHistoryEntry());

    await resetSecrets();

    await expect(fs.access(keyPath())).rejects.toBeDefined();
    await expect(fs.access(connectionsPath())).rejects.toBeDefined();
    await expect(fs.access(historyDir())).rejects.toBeDefined();
  });

  it("returns empty results after reset and rotates the crypto key on next write", async () => {
    await saveConnections([makeConnection()]);
    await appendHistory(makeHistoryEntry());
    const firstKey = await fs.readFile(keyPath(), "utf8");

    await resetSecrets();

    await expect(getConnections()).resolves.toStrictEqual([]);
    await expect(getHistory("c1")).resolves.toStrictEqual([]);

    await saveConnections([makeConnection()]);
    const secondKey = await fs.readFile(keyPath(), "utf8");
    expect(secondKey).not.toBe(firstKey);
  });
});
