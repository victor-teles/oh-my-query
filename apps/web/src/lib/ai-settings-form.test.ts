import { describe, expect, it } from "vitest";

import {
  canSaveAISettingsDraft,
  isAISettingsConfigured,
  normalizeAISettingsDraft,
} from "@/lib/ai-settings-form";

describe("normalizeAISettingsDraft", () => {
  it("trims hosted-provider fields and fills a default model", () => {
    expect(
      normalizeAISettingsDraft({
        apiKey: "  sk-key  ",
        baseUrl: "  ",
        model: "",
        provider: "openai",
      })
    ).toEqual({
      apiKey: "sk-key",
      baseUrl: undefined,
      model: "gpt-4o",
      provider: "openai",
    });
  });

  it("fills a default local base URL and allows an empty API key", () => {
    expect(
      normalizeAISettingsDraft({
        apiKey: "   ",
        baseUrl: "",
        model: "",
        provider: "local",
      })
    ).toEqual({
      apiKey: "",
      baseUrl: "http://localhost:11434/v1",
      model: "llama3",
      provider: "local",
    });
  });
});

describe("AI settings gating", () => {
  it("treats local settings without an API key as configured", () => {
    const settings = normalizeAISettingsDraft({
      apiKey: "",
      baseUrl: "",
      model: "",
      provider: "local",
    });

    expect(canSaveAISettingsDraft(settings)).toBe(true);
    expect(isAISettingsConfigured(settings)).toBe(true);
  });

  it("requires a non-empty API key for hosted providers", () => {
    const settings = normalizeAISettingsDraft({
      apiKey: "   ",
      baseUrl: "",
      model: "",
      provider: "anthropic",
    });

    expect(canSaveAISettingsDraft(settings)).toBe(false);
    expect(isAISettingsConfigured(settings)).toBe(false);
  });
});
