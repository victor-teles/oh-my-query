import { describe, expect, it } from "vitest";

import { makeRecent } from "@/test/widget-fixtures";

import type { HistoryEntry } from "./history-search";

import { flattenHistory, historySections } from "./history-search";

const at = (...parts: [number, number, number, number?, number?]) => {
  const [year, month, day, hours = 12, minutes = 0] = parts;
  return new Date(year, month, day, hours, minutes).toISOString();
};

const entry = (
  id: string,
  askedAt: string,
  overrides: Partial<HistoryEntry["ask"]> = {},
  connectionName: string | null = "analytics"
): HistoryEntry => ({
  ask: makeRecent({ askedAt, id, ...overrides }),
  connectionName,
});

const labels = (entries: HistoryEntry[], now: Date) =>
  historySections(entries, "", now).map((section) => [
    section.label,
    section.entries.map((match) => match.entry.ask.id),
  ]);

const ids = (entries: HistoryEntry[], query: string) =>
  flattenHistory(historySections(entries, query, new Date())).map(
    (match) => match.entry.ask.id
  );

describe("history day groups", () => {
  it("groups by local day, newest first within a group", () => {
    const now = new Date(2026, 10, 19, 15, 0);
    const entries = [
      entry("older-today", at(2026, 10, 19, 8)),
      entry("yesterday", at(2026, 10, 18, 23, 59)),
      entry("today", at(2026, 10, 19, 14)),
      entry("tuesday", at(2026, 10, 17)),
      entry("friday", at(2026, 10, 13)),
      entry("last-week", at(2026, 10, 12)),
      entry("october", at(2026, 9, 2)),
    ];
    expect(labels(entries, now)).toStrictEqual([
      ["Today", ["today", "older-today"]],
      ["Yesterday", ["yesterday"]],
      ["Tuesday", ["tuesday"]],
      ["Friday", ["friday"]],
      ["November 2026", ["last-week"]],
      ["October 2026", ["october"]],
    ]);
  });

  it("starts a new day just after midnight", () => {
    const now = new Date(2026, 10, 19, 0, 1);
    expect(
      labels(
        [
          entry("now", at(2026, 10, 19, 0, 0)),
          entry("late", at(2026, 10, 18, 23, 58)),
        ],
        now
      )
    ).toStrictEqual([
      ["Today", ["now"]],
      ["Yesterday", ["late"]],
    ]);
  });

  it("counts days across a month and a year", () => {
    const now = new Date(2027, 0, 1, 9);
    expect(
      labels(
        [entry("eve", at(2026, 11, 31)), entry("week", at(2026, 11, 26))],
        now
      )
    ).toStrictEqual([
      ["Yesterday", ["eve"]],
      ["Saturday", ["week"]],
    ]);
  });

  it("counts calendar days across a DST change", () => {
    const now = new Date(2026, 2, 30, 0, 30);
    expect(
      labels([entry("before", at(2026, 2, 28, 23, 30))], now)
    ).toStrictEqual([["Saturday", ["before"]]]);
    const autumn = new Date(2026, 9, 26, 0, 30);
    expect(
      labels([entry("before", at(2026, 9, 25, 23, 30))], autumn)
    ).toStrictEqual([["Yesterday", ["before"]]]);
  });

  it("treats a future or unreadable timestamp gracefully", () => {
    const now = new Date(2026, 10, 19, 9);
    expect(
      labels(
        [entry("skewed", at(2026, 10, 20)), entry("broken", "not a date")],
        now
      )
    ).toStrictEqual([
      ["Earlier", ["broken"]],
      ["Today", ["skewed"]],
    ]);
  });

  it("returns no sections for no entries", () => {
    expect(historySections([], "", new Date())).toStrictEqual([]);
    expect(historySections([], "mrr", new Date())).toStrictEqual([]);
  });
});

describe("history search", () => {
  it("puts every hit in one Matches section with prompt highlights", () => {
    const entries = [
      entry("a1", at(2026, 10, 18), { prompt: "Signups by plan" }),
    ];
    const [section] = historySections(entries, "sign", new Date());
    expect(section).toMatchObject({ id: "matches", label: "Matches" });
    expect(section?.entries[0]?.promptMatches).toStrictEqual([0, 1, 2, 3]);
  });

  it("ranks a prompt hit above the same word in SQL", () => {
    const entries = [
      entry("in-sql", at(2026, 10, 18, 12), {
        prompt: "Monthly revenue",
        sql: "select * from signups",
      }),
      entry("in-prompt", at(2026, 10, 17), {
        prompt: "signups this week",
        sql: "select 1",
      }),
    ];
    expect(ids(entries, "signups")).toStrictEqual(["in-prompt", "in-sql"]);
  });

  it("finds a word that only appears in the SQL", () => {
    const entries = [
      entry("a1", at(2026, 10, 18), {
        prompt: "Revenue for Europe",
        sql: "select sum(mrr) from billing_events where region = 'EU'",
      }),
      entry("a2", at(2026, 10, 18), { prompt: "Churn", sql: "select 1" }),
    ];
    expect(ids(entries, "billing")).toStrictEqual(["a1"]);
  });

  it("does not match SQL keywords or across separate words", () => {
    const entries = [
      entry("a1", at(2026, 10, 18), {
        prompt: "Churn",
        sql: "select id from accounts where closed",
      }),
    ];
    expect(ids(entries, "select")).toStrictEqual([]);
    expect(ids(entries, "idacc")).toStrictEqual([]);
  });

  it("matches the card title and the connection name", () => {
    const entries = [
      entry("title", at(2026, 10, 18), {
        prompt: "q1",
        spec: { ...makeRecent().spec, title: "Weekly signups" },
      }),
      entry("conn", at(2026, 10, 18), { prompt: "q2" }, "warehouse"),
    ];
    expect(ids(entries, "weekly")).toStrictEqual(["title"]);
    expect(ids(entries, "warehouse")).toStrictEqual(["conn"]);
  });

  it("breaks ties by recency", () => {
    const entries = [
      entry("old", at(2026, 10, 1), { prompt: "mrr" }),
      entry("new", at(2026, 10, 18), { prompt: "mrr" }),
    ];
    expect(ids(entries, "mrr")).toStrictEqual(["new", "old"]);
  });

  it("returns no sections when nothing matches", () => {
    expect(
      historySections([entry("a1", at(2026, 10, 18))], "zzzz", new Date())
    ).toStrictEqual([]);
  });
});
