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

  it("includes the chart components", () => {
    for (const name of ["ChartBar", "ChartLine", "ChartPie", "ChartKpi"]) {
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

  it("teaches the model the chart data-binding contract", () => {
    const prompt = buildUiGenerationPrompt();
    expect(prompt).toContain("Charts & result data");
    expect(prompt).toContain('"$bindState": "/result/rows"');
    expect(prompt).toContain("Never invent numeric values");
    expect(prompt).toContain("500 points");
  });

  it("teaches the combined SQL + jsonrender response pattern", () => {
    const prompt = buildUiGenerationPrompt();
    expect(prompt).toContain(
      "```sql block for the query AND a ```jsonrender block"
    );
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
