import { describe, expect, it } from "vitest";

import { createAIModel, resolveModelId } from "./ai-model.ts";

describe("resolveModelId", () => {
  it("prefers the configured model", () => {
    expect(
      resolveModelId({ apiKey: "k", model: "gpt-5-mini", provider: "openai" })
    ).toBe("gpt-5-mini");
  });

  it("falls back to the provider default", () => {
    expect(resolveModelId({ apiKey: "k", provider: "anthropic" })).toBe(
      "claude-opus-5-5"
    );
  });

  it("has no default for OpenRouter", () => {
    expect(resolveModelId({ apiKey: "k", provider: "openrouter" })).toBeNull();
  });
});

describe("createAIModel", () => {
  it.each([
    ["openai", "gpt-5.2"],
    ["anthropic", "claude-opus-5-5"],
    ["google", "gemini-2.5-pro"],
    ["openrouter", "anthropic/claude-opus-5-5"],
    ["local", "llama3"],
  ] as const)("builds a %s model", (provider, modelId) => {
    const model = createAIModel({ apiKey: "test-key", provider }, modelId);
    expect(model).toMatchObject({ modelId });
  });
});
