import { describe, expect, it } from "vitest";

import {
  canSaveAISettingsDraft,
  isAISettingsConfigured,
  normalizeAISettingsDraft,
} from "@/lib/ai-settings-form";

describe("ai settings draft normalization", () => {
  it("trims hosted-provider fields and fills a default model", () => {
    expect(
      normalizeAISettingsDraft({
        apiKey: "  sk-key  ",
        baseUrl: "  ",
        model: "",
        provider: "openai",
      })
    ).toStrictEqual({
      apiKey: "sk-key",
      baseUrl: undefined,
      model: "gpt-4.1",
      provider: "openai",
    });
  });

  it("trims google api key and fills the gemini default model", () => {
    expect(
      normalizeAISettingsDraft({
        apiKey: "  g-key  ",
        baseUrl: "",
        model: "",
        provider: "google",
      })
    ).toStrictEqual({
      apiKey: "g-key",
      baseUrl: undefined,
      model: "gemini-2.5-flash",
      provider: "google",
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
    ).toStrictEqual({
      apiKey: "",
      baseUrl: "http://localhost:11434/v1",
      model: "llama3",
      provider: "local",
    });
  });
});

describe("ai settings gating", () => {
  it("treats local settings without an API key as configured", () => {
    const settings = normalizeAISettingsDraft({
      apiKey: "",
      baseUrl: "",
      model: "",
      provider: "local",
    });

    expect(canSaveAISettingsDraft(settings)).toBeTruthy();
    expect(isAISettingsConfigured(settings)).toBeTruthy();
  });

  it("requires a non-empty API key for hosted providers", () => {
    const settings = normalizeAISettingsDraft({
      apiKey: "   ",
      baseUrl: "",
      model: "",
      provider: "anthropic",
    });

    expect(canSaveAISettingsDraft(settings)).toBeFalsy();
    expect(isAISettingsConfigured(settings)).toBeFalsy();
  });
});
