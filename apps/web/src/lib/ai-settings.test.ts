import { describe, expect, it } from "vitest";

import {
  getAISettings,
  getDefaultModel,
  hasAISettings,
  saveAISettings,
} from "@/lib/ai-settings";
import { mockTauri } from "@/test/tauri-mock";

describe("getDefaultModel", () => {
  it("returns provider-specific defaults", () => {
    expect(getDefaultModel("openai")).toMatch(/gpt/);
    expect(getDefaultModel("anthropic")).toMatch(/claude/);
    expect(getDefaultModel("openrouter")).toMatch(/claude/);
    expect(getDefaultModel("local")).toBe("llama3");
  });
});

describe("getAISettings", () => {
  it("returns null in browser (non-Tauri) environments", async () => {
    await expect(getAISettings()).resolves.toBeNull();
  });

  it("returns the settings from get_config in Tauri", async () => {
    const stored = {
      apiKey: "sk-test",
      model: "gpt-4o",
      provider: "openai" as const,
    };
    mockTauri({
      get_config: () => ({ ai: stored }),
    });

    await expect(getAISettings()).resolves.toStrictEqual(stored);
  });

  it("returns null when ai is missing from the config", async () => {
    mockTauri({
      get_config: () => ({}),
    });
    await expect(getAISettings()).resolves.toBeNull();
  });
});

describe("saveAISettings", () => {
  it("does nothing in browser environments", async () => {
    await expect(
      saveAISettings({ apiKey: "x", provider: "openai" })
    ).resolves.toBeUndefined();
  });

  it("normalizes and persists settings via save_config", async () => {
    let saved: unknown = null;
    mockTauri({
      get_config: () => ({}),
      save_config: (payload) => {
        saved = payload;
      },
    });

    await saveAISettings({
      apiKey: "  sk-test  ",
      baseUrl: "",
      model: "",
      provider: "openai",
    });

    expect(saved).toMatchObject({
      config: {
        ai: expect.objectContaining({
          apiKey: "sk-test",
          provider: "openai",
        }),
      },
    });
  });
});

describe("hasAISettings", () => {
  it("is false when no settings stored", async () => {
    await expect(hasAISettings()).resolves.toBeFalsy();
  });

  it("is true when settings are configured", async () => {
    mockTauri({
      get_config: () => ({
        ai: { apiKey: "sk-test", provider: "openai" as const },
      }),
    });
    await expect(hasAISettings()).resolves.toBeTruthy();
  });
});
