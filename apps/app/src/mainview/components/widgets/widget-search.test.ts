import { describe, expect, it } from "vitest";

import { makeWidget } from "@/test/widget-fixtures";

import { filterWidgets } from "./widget-search";

const revenue = makeWidget();
const signups = makeWidget({
  id: "w-signups",
  name: "Weekly signups",
  prompt: "signups by plan",
});

describe("filterWidgets", () => {
  it("keeps every widget for an empty query", () => {
    expect(filterWidgets([revenue, signups], "  ")).toStrictEqual([
      revenue,
      signups,
    ]);
  });

  it("matches on name and prompt", () => {
    expect(filterWidgets([revenue, signups], "signup")).toStrictEqual([
      signups,
    ]);
    expect(filterWidgets([revenue, signups], "by plan")).toStrictEqual([
      signups,
    ]);
  });

  it("drops widgets that don't match", () => {
    expect(filterWidgets([revenue, signups], "zzz")).toStrictEqual([]);
  });
});
