import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it, vi } from "vitest";

import { probeModel } from "./probe-model.ts";

const usage = {
  inputTokens: {
    cacheRead: undefined,
    cacheWrite: undefined,
    noCache: 1,
    total: 1,
  },
  outputTokens: { reasoning: undefined, text: 1, total: 1 },
};

describe("probeModel", () => {
  it("reports a working model", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: {
        content: [{ text: "OK", type: "text" }],
        finishReason: { raw: undefined, unified: "stop" },
        usage,
        warnings: [],
      },
    });
    await expect(probeModel(model, "gpt-5.2")).resolves.toMatchObject({
      message: "Connected to gpt-5.2",
      ok: true,
    });
  });

  it("explains a rejected key", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error("Unauthorized"), { status: 401 })
        ),
    });
    await expect(probeModel(model, "gpt-5.2")).resolves.toMatchObject({
      message:
        "Invalid API key or unauthorized access. Check your API key in AI settings.",
      ok: false,
    });
  });
});
