import { describe, expect, it } from "vitest";

import type { RedactedAiSettings } from "./ai-providers.ts";

import { isAiConfigured, isAiProvider } from "./ai-providers.ts";

const settings = (
  overrides: Partial<RedactedAiSettings>
): RedactedAiSettings => ({
  baseUrl: null,
  hasKey: false,
  keyHint: null,
  model: null,
  provider: "anthropic",
  ...overrides,
});

describe("isAiConfigured", () => {
  it("is false without settings", () => {
    expect(isAiConfigured(null)).toBeFalsy();
  });

  it("needs a key for hosted providers", () => {
    expect(isAiConfigured(settings({}))).toBeFalsy();
    expect(isAiConfigured(settings({ hasKey: true }))).toBeTruthy();
  });

  it("accepts a local provider without a key", () => {
    expect(isAiConfigured(settings({ provider: "local" }))).toBeTruthy();
  });

  it("needs an explicit model when the provider has no default", () => {
    expect(
      isAiConfigured(settings({ hasKey: true, provider: "openrouter" }))
    ).toBeFalsy();
    expect(
      isAiConfigured(
        settings({
          hasKey: true,
          model: "anthropic/claude-opus-5-5",
          provider: "openrouter",
        })
      )
    ).toBeTruthy();
  });
});

describe("isAiProvider", () => {
  it("narrows known provider ids", () => {
    expect(isAiProvider("google")).toBeTruthy();
    expect(isAiProvider("cohere")).toBeFalsy();
  });
});
