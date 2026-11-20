import { describe, expect, it } from "vitest";

import { assumptionChips } from "./assumption-chips";

describe("assumptionChips", () => {
  it("is empty without assumptions", () => {
    expect(assumptionChips(null)).toStrictEqual([]);
    expect(assumptionChips({ items: [] })).toStrictEqual([]);
  });

  it("joins the tables into one plain chip and orders the rest", () => {
    const chips = assumptionChips({
      items: [
        { kind: "table", name: "orders" },
        { kind: "table", name: "regions" },
        { column: "orders.created_at", grain: "month", kind: "time" },
        { column: "status", kind: "filter", text: "status <> 'refunded'" },
        { kind: "limit", rows: 500 },
      ],
    });
    expect(chips.map((chip) => chip.label)).toStrictEqual([
      "orders, regions",
      "orders.created_at · by month",
      "status <> 'refunded'",
      "top 500",
    ]);
    expect(chips[0]?.prefill).toBeNull();
  });

  it.each([
    [
      { column: "created_at", grain: "month" as const, kind: "time" as const },
      "group by week instead of by month",
      "week",
    ],
    [
      { column: "created_at", grain: "year" as const, kind: "time" as const },
      "group by quarter instead of by year",
      "quarter",
    ],
    [
      { column: "created_at", grain: null, kind: "time" as const },
      "use another date column than created_at",
      "another date column",
    ],
  ])(
    "pre-fills a time chip and selects the word to edit",
    (item, text, word) => {
      const [chip] = assumptionChips({ items: [item] });
      const start = text.indexOf(word);
      expect(chip?.prefill).toStrictEqual({
        selection: [start, start + word.length],
        text,
      });
    }
  );

  it("pre-fills filter and limit chips with the caret at the end", () => {
    const chips = assumptionChips({
      items: [
        { column: null, kind: "filter", text: "total > 10" },
        { kind: "limit", rows: 50 },
      ],
    });
    expect(chips.map((chip) => chip.prefill)).toStrictEqual([
      { selection: null, text: "without total > 10" },
      { selection: null, text: "show all rows, not only the top 50" },
    ]);
  });
});
