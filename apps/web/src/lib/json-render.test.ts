import { describe, expect, it } from "vitest";

import {
  buildUiGenerationPrompt,
  buildSystemPrompt,
} from "@/lib/ai-schema-formatter";
import { knownComponentNames, promptComponents } from "@/lib/json-render";

const emptySchema = { schemas: [] };

describe("json-render catalog", () => {
  it("exports the same component names in promptComponents and knownComponentNames", () => {
    const promptNames = new Set(promptComponents.map((c) => c.name));
    expect(promptNames).toStrictEqual(knownComponentNames);
  });

  it("includes the production base components", () => {
    for (const name of [
      "Card",
      "Stack",
      "Grid",
      "Heading",
      "Text",
      "Badge",
      "Table",
      "Alert",
    ]) {
      expect(knownComponentNames.has(name)).toBeTruthy();
    }
  });

  it("emits each catalog component into the UI generation prompt", () => {
    const prompt = buildUiGenerationPrompt();
    for (const c of promptComponents) {
      expect(prompt).toContain(`${c.name}: ${c.signature}`);
      expect(prompt).toContain(c.summary);
    }
  });

  it("does not advertise components that aren't in the registry", () => {
    const prompt = buildUiGenerationPrompt();
    expect(prompt).not.toMatch(/^(Button|Input|Form|Modal):/m);
  });

  it("wires the UI generation block into the SQL system prompt", () => {
    const prompt = buildSystemPrompt(emptySchema, "postgresql");
    expect(prompt).toContain("```jsonrender");
    expect(prompt).toContain("Available Components:");
  });

  it("wires the UI generation block into the Redis system prompt", () => {
    const prompt = buildSystemPrompt(
      { schemas: [{ name: "db0", tables: [], views: [] }] },
      "redis",
      []
    );
    expect(prompt).toContain("```jsonrender");
    expect(prompt).toContain("Available Components:");
  });
});
