import type * as NodeOs from "node:os";

import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const TMP_HOME = mkdtempSync(path.join(os.tmpdir(), "conch-core-app-dir-"));

vi.mock<typeof NodeOs>(import("node:os"), async () => {
  const actual = await vi.importActual<typeof NodeOs>("node:os");
  return {
    ...actual,
    default: { ...actual, homedir: () => TMP_HOME },
    homedir: () => TMP_HOME,
  };
});

const { migrateLegacyAppDir } = await import("./app-dir-migration.ts");
const { appDir, configPath, keyPath } = await import("./paths.ts");

const LEGACY_DIR = path.join(TMP_HOME, ".config/oh-my-query");

const writeLegacy = async (files: Record<string, string>): Promise<void> => {
  await fs.mkdir(LEGACY_DIR, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    await fs.writeFile(path.join(LEGACY_DIR, name), content);
  }
};

describe("migrateLegacyAppDir", () => {
  beforeEach(async () => {
    await fs.rm(path.join(TMP_HOME, ".config"), {
      force: true,
      recursive: true,
    });
  });

  afterAll(async () => {
    await fs.rm(TMP_HOME, { force: true, recursive: true });
  });

  it("moves the legacy directory and renames its config file", async () => {
    await writeLegacy({
      ".key": "secret",
      "oh-my-query.json": '{"launcherHotkey":"Cmd+K"}',
      "widgets.enc": "w",
    });

    await expect(migrateLegacyAppDir()).resolves.toBeTruthy();

    await expect(fs.readFile(configPath(), "utf8")).resolves.toBe(
      '{"launcherHotkey":"Cmd+K"}'
    );
    await expect(fs.readFile(keyPath(), "utf8")).resolves.toBe("secret");
    await expect(
      fs.readFile(path.join(appDir(), "widgets.enc"), "utf8")
    ).resolves.toBe("w");
    await expect(fs.access(LEGACY_DIR)).rejects.toThrow("ENOENT");
  });

  it("moves a legacy directory that has no config file", async () => {
    await writeLegacy({ "boards.enc": "b" });

    await expect(migrateLegacyAppDir()).resolves.toBeTruthy();

    await expect(
      fs.readFile(path.join(appDir(), "boards.enc"), "utf8")
    ).resolves.toBe("b");
    await expect(fs.access(configPath())).rejects.toThrow("ENOENT");
  });

  it("leaves both directories alone when the new one already exists", async () => {
    await writeLegacy({ "widgets.enc": "old" });
    await fs.mkdir(appDir(), { recursive: true });
    await fs.writeFile(path.join(appDir(), "widgets.enc"), "new");

    await expect(migrateLegacyAppDir()).resolves.toBeFalsy();

    await expect(
      fs.readFile(path.join(appDir(), "widgets.enc"), "utf8")
    ).resolves.toBe("new");
    await expect(
      fs.readFile(path.join(LEGACY_DIR, "widgets.enc"), "utf8")
    ).resolves.toBe("old");
  });

  it("does nothing on a fresh install", async () => {
    await expect(migrateLegacyAppDir()).resolves.toBeFalsy();
    await expect(fs.access(appDir())).rejects.toThrow("ENOENT");
  });
});
