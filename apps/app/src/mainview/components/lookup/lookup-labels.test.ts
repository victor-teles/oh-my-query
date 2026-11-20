import { describe, expect, it } from "vitest";

import type { LookupHit } from "@/lib/ipc";

import type { LookupState } from "./lookup-reducer";

import {
  announcement,
  countLabel,
  emptyCopy,
  rowsLabel,
  shortValue,
  statusLine,
  statusNotes,
} from "./lookup-labels";
import { initialLookupState } from "./lookup-reducer";

const UUID = "3f2a1b4c-9d8e-4f7a-b6c5-d4e3f2a1c91e";

const hit = (table: string, matchedRows = 1, capped = false): LookupHit => ({
  capped,
  column: "id",
  elapsedMs: 2,
  matchedRows,
  rank: 0,
  schema: "public",
  table,
});

const state = (overrides: Partial<LookupState>): LookupState => ({
  ...initialLookupState,
  tables: 14,
  value: { kind: "uuid", value: UUID },
  ...overrides,
});

describe("shortValue", () => {
  it.each([
    [{ kind: "uuid", value: UUID }, "3f2a1b…c91e"],
    [{ kind: "integer", value: "42" }, "42"],
    [{ kind: "email", value: "ada@example.com" }, "ada@example.com"],
    [
      { kind: "email", value: "a.very.long.mailbox.name@example.co.uk" },
      "a.very.long.ma…example.co.uk",
    ],
  ] as const)("shortens %o to %s", (value, expected) => {
    expect(shortValue(value)).toBe(expected);
  });
});

describe("counts", () => {
  it.each([
    [hit("users", 1), "1", "1 row"],
    [hit("orders", 12), "12", "12 rows"],
    [hit("events", 100, true), "100+", "100 or more rows"],
  ])("labels %o", (item, count, rows) => {
    expect([countLabel(item), rowsLabel(item)]).toStrictEqual([count, rows]);
  });
});

const STATUS_LINES: [Partial<LookupState>, string][] = [
  [{ status: "planning" }, "Reading the schema…"],
  [{ status: "probing" }, "Searching 14 tables…"],
  [
    { elapsedMs: 412, hits: [hit("a"), hit("b"), hit("c")], status: "done" },
    "Found in 3 tables · 412ms",
  ],
  [{ elapsedMs: 80, status: "done" }, "No matches · 80ms"],
  [{ done: 6, status: "cancelled", total: 14 }, "Stopped · 6 of 14 columns"],
  [{ status: "cancelled" }, "Stopped"],
  [
    { error: { code: "UNSUPPORTED_ENGINE", message: "x" }, status: "error" },
    "Can't search this connection",
  ],
];

describe("statusLine", () => {
  it.each(STATUS_LINES)("reads %o as %s", (overrides, line) => {
    expect(statusLine(state(overrides))).toBe(line);
  });

  it("notes slow columns and the time limit once done", () => {
    expect(
      statusNotes(state({ budgetExceeded: true, failed: 2, status: "done" }))
    ).toStrictEqual([
      "2 columns didn't answer in time.",
      "Stopped at the 15-second limit.",
    ]);
    expect(statusNotes(state({ failed: 2, status: "probing" }))).toStrictEqual(
      []
    );
  });
});

const ANNOUNCEMENTS: [Partial<LookupState>, string][] = [
  [{ status: "planning" }, ""],
  [{ status: "probing" }, ""],
  [{ firstHit: hit("orders"), status: "probing" }, "Found in orders"],
  [
    { hits: [hit("users"), hit("orders"), hit("events")], status: "done" },
    "Found in users, orders, and events",
  ],
  [{ status: "done" }, "No matches in 14 tables"],
  [{ status: "cancelled" }, "Search stopped"],
  [{ error: { code: "FAILED", message: "Boom." }, status: "error" }, "Boom."],
];

describe("announcement", () => {
  it.each(ANNOUNCEMENTS)("announces %o as %j", (overrides, text) => {
    expect(announcement(state(overrides))).toBe(text);
  });
});

describe("emptyCopy", () => {
  it("names the value, the tables searched and what was skipped", () => {
    expect(
      emptyCopy(
        state({
          skipped: { largeUnindexed: 3, outOfRange: 1, overLimit: 1 },
          status: "done",
        })
      )
    ).toStrictEqual({
      notes: [
        "Exact match only.",
        "Skipped 3 large tables without an index on the column.",
        "Skipped 1 column too small for this number.",
        "1 more column wasn't searched.",
      ],
      title: "No rows match 3f2a1b…c91e in 14 tables.",
    });
  });

  it("says emails are compared as typed", () => {
    expect(
      emptyCopy(state({ value: { kind: "email", value: "ada@example.com" } }))
        .notes
    ).toStrictEqual(["Exact match. Emails are compared as typed."]);
  });
});
