import type * as NodeOs from "node:os";

import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const TMP_HOME = mkdtempSync(path.join(os.tmpdir(), "omq-core-config-"));

vi.mock<typeof NodeOs>(import("node:os"), async () => {
  const actual = await vi.importActual<typeof NodeOs>("node:os");
  return {
    ...actual,
    default: { ...actual, homedir: () => TMP_HOME },
    homedir: () => TMP_HOME,
  };
});

const { getConfig, saveConfig } = await import("./config.ts");
const { configPath } = await import("./paths.ts");
const { appConfigDir } = await import("./test-utils.ts");

describe("config", () => {
  beforeEach(async () => {
    await fs.rm(appConfigDir(TMP_HOME), { force: true, recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TMP_HOME, { force: true, recursive: true });
  });

  it("returns {} when the config file does not exist", async () => {
    const cfg = await getConfig();
    expect(cfg).toStrictEqual({});
  });

  it("round-trips an AI settings payload", async () => {
    const payload = {
      ai: { apiKey: "k-123", model: "claude-opus-4-7", provider: "anthropic" },
    };
    await saveConfig(payload);
    const back = await getConfig();
    expect(back).toStrictEqual(payload);
  });

  it("creates parent directories when saving", async () => {
    await fs.rm(appConfigDir(TMP_HOME), { force: true, recursive: true });
    await saveConfig({ ai: null });
    const stat = await fs.stat(configPath());
    expect(stat.isFile()).toBeTruthy();
  });

  it("writes pretty-printed JSON with two-space indent", async () => {
    await saveConfig({ ai: { apiKey: "k", provider: "anthropic" } });
    const raw = await fs.readFile(configPath(), "utf8");
    expect(raw).toContain("\n  ");
  });

  it("propagates a SyntaxError when the file is not valid JSON", async () => {
    await fs.mkdir(appConfigDir(TMP_HOME), { recursive: true });
    await fs.writeFile(configPath(), "not json");
    await expect(getConfig()).rejects.toThrow(SyntaxError);
  });
});
