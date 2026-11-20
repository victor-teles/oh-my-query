import type * as NodeOs from "node:os";

import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const TMP_HOME = mkdtempSync(path.join(os.tmpdir(), "omq-core-ai-config-"));

vi.mock<typeof NodeOs>(import("node:os"), async () => {
  const actual = await vi.importActual<typeof NodeOs>("node:os");
  return {
    ...actual,
    default: { ...actual, homedir: () => TMP_HOME },
    homedir: () => TMP_HOME,
  };
});

const { CryptoError, resetCryptoCache, setLegacyKeyLoader } =
  await import("./crypto.ts");
const {
  clearAiKey,
  getAiSettings,
  mergeAiSettings,
  redactAiSettings,
  saveAiSettings,
} = await import("./ai-config.ts");
const { getConfig, saveConfig } = await import("./config.ts");
const { aiConfigPath, configPath } = await import("./paths.ts");
const { appConfigDir } = await import("./test-utils.ts");

// oxlint-disable-next-line require-await -- placeholder loader for tests
const noLegacyKey = async (): Promise<string | null> => null;
const ANTHROPIC_KEY = "sk-ant-test-0123456789-a1b2";

describe("ai-config", () => {
  beforeEach(async () => {
    resetCryptoCache();
    setLegacyKeyLoader(noLegacyKey);
    await fs.rm(appConfigDir(TMP_HOME), { force: true, recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TMP_HOME, { force: true, recursive: true });
  });

  it("returns null before anything is configured", async () => {
    await expect(getAiSettings()).resolves.toBeNull();
  });

  it("round-trips settings through the encrypted file", async () => {
    await saveAiSettings({
      apiKey: ANTHROPIC_KEY,
      model: "claude-opus-5-5",
      provider: "anthropic",
    });

    await expect(getAiSettings()).resolves.toStrictEqual({
      apiKey: ANTHROPIC_KEY,
      model: "claude-opus-5-5",
      provider: "anthropic",
    });
    const raw = await fs.readFile(aiConfigPath(), "utf8");
    expect(raw).not.toContain(ANTHROPIC_KEY);
    expect(raw).not.toContain("anthropic");
  });

  it("keeps the stored key when an update omits it", async () => {
    await saveAiSettings({ apiKey: ANTHROPIC_KEY, provider: "anthropic" });
    await saveAiSettings({ model: "claude-sonnet-5-5", provider: "anthropic" });

    const stored = await getAiSettings();
    expect(stored?.apiKey).toBe(ANTHROPIC_KEY);
    expect(stored?.model).toBe("claude-sonnet-5-5");
  });

  it("drops the key when the provider changes without a new one", async () => {
    await saveAiSettings({ apiKey: ANTHROPIC_KEY, provider: "anthropic" });
    await saveAiSettings({ provider: "openai" });

    await expect(getAiSettings()).resolves.toMatchObject({
      apiKey: "",
      provider: "openai",
    });
  });

  it("clears the key but keeps the provider choice", async () => {
    await saveAiSettings({ apiKey: ANTHROPIC_KEY, provider: "anthropic" });

    await clearAiKey();

    await expect(getAiSettings()).resolves.toMatchObject({
      apiKey: "",
      provider: "anthropic",
    });
  });

  it("returns null when clearing with nothing configured", async () => {
    await expect(clearAiKey()).resolves.toBeNull();
  });

  it("migrates a plaintext key out of oh-my-query.json", async () => {
    await saveConfig({
      ai: { apiKey: ANTHROPIC_KEY, provider: "anthropic" },
      launcherHotkey: "Control+Space",
    });

    await expect(getAiSettings()).resolves.toMatchObject({
      apiKey: ANTHROPIC_KEY,
      provider: "anthropic",
    });

    const plaintext = await fs.readFile(configPath(), "utf8");
    expect(plaintext).not.toContain("apiKey");
    expect(plaintext).not.toContain(ANTHROPIC_KEY);
    await expect(getConfig()).resolves.toStrictEqual({
      launcherHotkey: "Control+Space",
    });
  });

  it("prefers the encrypted copy and still strips a leftover plaintext key", async () => {
    await saveAiSettings({ apiKey: ANTHROPIC_KEY, provider: "anthropic" });
    await saveConfig({
      ai: { apiKey: "stale-plaintext-key", provider: "openai" },
    });

    await expect(getAiSettings()).resolves.toMatchObject({
      apiKey: ANTHROPIC_KEY,
      provider: "anthropic",
    });
    await expect(getConfig()).resolves.toStrictEqual({});
  });

  it("surfaces a corrupt encrypted file instead of returning null", async () => {
    await saveAiSettings({ apiKey: ANTHROPIC_KEY, provider: "anthropic" });
    await fs.writeFile(aiConfigPath(), "not-a-valid-ciphertext");

    await expect(getAiSettings()).rejects.toBeInstanceOf(CryptoError);
  });
});

describe("mergeAiSettings", () => {
  it("trims values and turns blanks into undefined", () => {
    expect(
      mergeAiSettings(null, {
        apiKey: "  key  ",
        baseUrl: "  ",
        model: " gpt-5.2 ",
        provider: "openai",
      })
    ).toStrictEqual({
      apiKey: "key",
      baseUrl: undefined,
      model: "gpt-5.2",
      provider: "openai",
    });
  });
});

describe("redactAiSettings", () => {
  it("returns null for missing settings", () => {
    expect(redactAiSettings(null)).toBeNull();
  });

  it("exposes only the last four characters of a long key", () => {
    expect(
      redactAiSettings({ apiKey: ANTHROPIC_KEY, provider: "anthropic" })
    ).toStrictEqual({
      baseUrl: null,
      hasKey: true,
      keyHint: "a1b2",
      model: null,
      provider: "anthropic",
    });
  });

  it("gives no hint for short keys and reports a missing key", () => {
    expect(
      redactAiSettings({ apiKey: "short-key", provider: "local" })?.keyHint
    ).toBeNull();
    expect(
      redactAiSettings({ apiKey: "", provider: "local" })?.hasKey
    ).toBeFalsy();
  });
});
