import { describe, expect, it } from "vitest";

import { askScriptFor, languageForType } from "@/lib/browser-ask-stub";

const params = (prompt: string) => ({
  askId: "a1",
  connectionId: "c1",
  database: null,
  prompt,
});

const eventsOf = (prompt: string, language: "mongodb" | "redis") =>
  askScriptFor(params(prompt), "shop", language).map(([, event]) => event);

describe("browser ask stub for MongoDB and Redis", () => {
  it.each([
    ["mongodb", "mongodb"],
    ["redis", "redis"],
    ["postgresql", "postgresql"],
    ["duckdb", "postgresql"],
    [undefined, "postgresql"],
  ] as const)("maps connection type %s to %s", (type, language) => {
    expect(languageForType(type)).toBe(language);
  });

  it.each([
    ["orders by status", "mongodb", "Orders by status"],
    ["keys by pattern", "redis", "Keys by pattern"],
    ["top 10 on the leaderboard", "redis", "Top 10 on the leaderboard"],
  ] as const)("replays %s on %s", (prompt, language, title) => {
    const events = eventsOf(prompt, language);
    expect(events).toContainEqual(
      expect.objectContaining({ dialect: language, type: "sqlDone" })
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        spec: expect.objectContaining({ title }),
        type: "card",
      })
    );
  });

  it.each([
    ["merge orders into the archive", "mongodb", "$merge"],
    ["delete the sessions", "redis", "SET"],
  ] as const)("refuses %s on %s", (prompt, language, token) => {
    const last = eventsOf(prompt, language).at(-1);
    expect(last).toMatchObject({
      code: "NOT_READ_ONLY",
      message: expect.stringMatching(new RegExp(`^\\${token}`)),
      type: "error",
    });
  });
});
