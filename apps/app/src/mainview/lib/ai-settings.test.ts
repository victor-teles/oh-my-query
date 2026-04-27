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
  it("returns the settings from getConfig", async () => {
    const stored = {
      apiKey: "sk-test",
      model: "gpt-4o",
      provider: "openai" as const,
    };
    mockTauri({
      getConfig: () => ({ ai: stored }),
    });

    await expect(getAISettings()).resolves.toStrictEqual(stored);
  });

  it("returns null when ai is missing from the config", async () => {
    mockTauri({
      getConfig: () => ({}),
    });
    await expect(getAISettings()).resolves.toBeNull();
  });
});

describe("saveAISettings", () => {
  it("normalizes and persists settings via saveConfig", async () => {
    let saved: unknown = null;
    mockTauri({
      getConfig: () => ({}),
      saveConfig: (payload) => {
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
    mockTauri({
      getConfig: () => ({}),
    });
    await expect(hasAISettings()).resolves.toBeFalsy();
  });

  it("is true when settings are configured", async () => {
    mockTauri({
      getConfig: () => ({
        ai: { apiKey: "sk-test", provider: "openai" as const },
      }),
    });
    await expect(hasAISettings()).resolves.toBeTruthy();
  });
});
