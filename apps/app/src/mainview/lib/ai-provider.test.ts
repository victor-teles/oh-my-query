import { describe, expect, it } from "vitest";

import { createAIModel } from "@/lib/ai-provider";

describe("createAIModel", () => {
  it("creates an OpenAI model when provider is openai", () => {
    const model = createAIModel({
      apiKey: "sk-test",
      provider: "openai",
    });
    expect(model).toBeTruthy();
  });

  it("creates an OpenAI-compatible model for the local provider", () => {
    const model = createAIModel({
      apiKey: "ignored",
      baseUrl: "http://127.0.0.1:11434/v1",
      provider: "local",
    });
    expect(model).toBeTruthy();
  });

  it("creates an OpenRouter model with the OpenRouter base URL", () => {
    const model = createAIModel({
      apiKey: "or-test",
      provider: "openrouter",
    });
    expect(model).toBeTruthy();
  });

  it("creates an Anthropic model when provider is anthropic", () => {
    const model = createAIModel({
      apiKey: "sk-ant-test",
      provider: "anthropic",
    });
    expect(model).toBeTruthy();
  });

  it("respects an explicit model override", () => {
    const model = createAIModel({
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      provider: "openai",
    });
    expect(model).toBeTruthy();
  });

  it("throws on an unsupported provider", () => {
    expect(() =>
      createAIModel({
        apiKey: "x",
        provider: "cohere" as unknown as "openai",
      })
    ).toThrow(/Unsupported AI provider/);
  });
});
