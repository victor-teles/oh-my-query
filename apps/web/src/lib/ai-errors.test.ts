import { describe, expect, it } from "vitest";

import { classifyAIError } from "@/lib/ai-errors";

describe("classifyAIError — by status code", () => {
  it.each([
    [401, "auth"],
    [403, "auth"],
    [429, "rate_limit"],
    [404, "model_not_found"],
    [500, "provider_error"],
    [502, "provider_error"],
    [503, "provider_error"],
  ] as const)("classifies %d as %s", (status, expected) => {
    const result = classifyAIError({ status });
    expect(result.type).toBe(expected);
    expect(result.message).toBeTruthy();
    expect(result.suggestion).toBeTruthy();
  });

  it("reads statusCode when status is missing", () => {
    expect(classifyAIError({ statusCode: 401 }).type).toBe("auth");
  });

  it("reads nested data.status", () => {
    expect(classifyAIError({ data: { status: 429 } }).type).toBe("rate_limit");
  });
});

describe("classifyAIError — by message text", () => {
  it.each([
    ["unauthorized", "auth"],
    ["Invalid API key provided", "auth"],
    ["incorrect API key", "auth"],
    ["authentication failed", "auth"],
    ["Rate limit exceeded", "rate_limit"],
    ["too many requests", "rate_limit"],
    ["Model not found", "model_not_found"],
    ["this model does not exist", "model_not_found"],
    ["model_not_found error", "model_not_found"],
    ["context length exceeded", "context_length"],
    ["token limit reached", "context_length"],
    ["maximum context tokens", "context_length"],
    ["too many tokens for this model", "context_length"],
    ["fetch failed", "network"],
    ["network unreachable", "network"],
    ["ECONNREFUSED", "network"],
    ["ENOTFOUND api.example.com", "network"],
    ["failed to fetch", "network"],
  ] as const)("classifies %j as %s", (message, expected) => {
    expect(classifyAIError(new Error(message)).type).toBe(expected);
  });
});

describe("classifyAIError — fallbacks", () => {
  it("falls back to unknown for unrelated text", () => {
    const result = classifyAIError(new Error("something completely random"));
    expect(result.type).toBe("unknown");
    expect(result.retryable).toBeTruthy();
  });

  it("handles non-Error values via String() coercion", () => {
    expect(classifyAIError("rate limit").type).toBe("rate_limit");
  });

  it("handles null and undefined", () => {
    expect(classifyAIError(null).type).toBe("unknown");
    expect(classifyAIError(undefined as unknown).type).toBe("unknown");
  });

  it("prefers status over message when both present", () => {
    const result = classifyAIError({
      message: "fetch failed",
      status: 401,
    });
    expect(result.type).toBe("auth");
  });

  it("falls through to message when status is non-classifying", () => {
    const err = new Error("rate limit hit");
    (err as Error & { status?: number }).status = 200;
    expect(classifyAIError(err).type).toBe("rate_limit");
  });
});

describe("classifyAIError — retryable flag", () => {
  it("marks auth and context_length as non-retryable", () => {
    expect(classifyAIError({ status: 401 }).retryable).toBeFalsy();
    expect(classifyAIError(new Error("context length")).retryable).toBeFalsy();
  });

  it("marks rate_limit, network, provider_error as retryable", () => {
    expect(classifyAIError({ status: 429 }).retryable).toBeTruthy();
    expect(classifyAIError(new Error("fetch failed")).retryable).toBeTruthy();
    expect(classifyAIError({ status: 500 }).retryable).toBeTruthy();
  });
});
