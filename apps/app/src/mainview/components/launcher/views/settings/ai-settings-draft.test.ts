import type { RedactedAiSettings } from "@oh-my-query/rpc";

import { describe, expect, it } from "vitest";

import {
  draftFromSettings,
  draftToInput,
  isDraftDirty,
  keyMask,
  switchProvider,
} from "./ai-settings-draft";

const saved: RedactedAiSettings = {
  baseUrl: null,
  hasKey: true,
  keyHint: "a1b2",
  model: "claude-sonnet-5-5",
  provider: "anthropic",
};

describe("draftFromSettings", () => {
  it("starts a fresh Anthropic draft with an empty key", () => {
    expect(draftFromSettings(null)).toStrictEqual({
      apiKey: "",
      baseUrl: "",
      model: "",
      provider: "anthropic",
    });
  });

  it("keeps a stored key untouched", () => {
    expect(draftFromSettings(saved)).toStrictEqual({
      apiKey: null,
      baseUrl: "",
      model: "claude-sonnet-5-5",
      provider: "anthropic",
    });
  });
});

describe("switchProvider", () => {
  it("starts a new key, model and base URL for another provider", () => {
    const draft = switchProvider(draftFromSettings(saved), "local", saved);
    expect(draft).toStrictEqual({
      apiKey: "",
      baseUrl: "http://localhost:11434/v1",
      model: "",
      provider: "local",
    });
  });

  it("restores the stored values when switching back", () => {
    const away = switchProvider(draftFromSettings(saved), "openai", saved);
    expect(switchProvider(away, "anthropic", saved)).toStrictEqual(
      draftFromSettings(saved)
    );
  });

  it("asks for a key when switching back to a provider without one", () => {
    const keyless = { ...saved, hasKey: false, keyHint: null };
    const draft = switchProvider(draftFromSettings(null), "anthropic", keyless);
    expect(draft.apiKey).toBe("");
  });
});

describe("draftToInput", () => {
  it("omits an untouched or blank key so the stored one is kept", () => {
    expect(draftToInput(draftFromSettings(saved)).apiKey).toBeUndefined();
    expect(
      draftToInput({ ...draftFromSettings(saved), apiKey: "  " }).apiKey
    ).toBeUndefined();
  });

  it("sends a replaced key", () => {
    const input = draftToInput({
      ...draftFromSettings(saved),
      apiKey: " sk-new ",
    });
    expect(input.apiKey).toBe("sk-new");
  });

  it("sends a base URL only for providers that need one", () => {
    expect(
      draftToInput({
        apiKey: "",
        baseUrl: "http://x",
        model: "",
        provider: "openai",
      })
    ).toStrictEqual({
      apiKey: undefined,
      baseUrl: undefined,
      model: undefined,
      provider: "openai",
    });
    expect(
      draftToInput({
        apiKey: null,
        baseUrl: " http://box:11434/v1 ",
        model: "qwen2.5-coder",
        provider: "local",
      })
    ).toStrictEqual({
      apiKey: undefined,
      baseUrl: "http://box:11434/v1",
      model: "qwen2.5-coder",
      provider: "local",
    });
  });
});

describe("isDraftDirty", () => {
  it("is dirty before anything is saved", () => {
    expect(isDraftDirty(draftFromSettings(null), null)).toBeTruthy();
  });

  it("is clean for the saved values and dirty after an edit", () => {
    const draft = draftFromSettings(saved);
    expect(isDraftDirty(draft, saved)).toBeFalsy();
    expect(isDraftDirty({ ...draft, model: "x" }, saved)).toBeTruthy();
    expect(isDraftDirty({ ...draft, apiKey: "sk" }, saved)).toBeTruthy();
    expect(isDraftDirty({ ...draft, apiKey: "" }, saved)).toBeFalsy();
  });
});

describe("keyMask", () => {
  it("shows the hint when the key is long enough", () => {
    expect(keyMask(saved)).toBe("•••• a1b2");
    expect(keyMask({ ...saved, keyHint: null })).toBe("••••••••");
  });
});
