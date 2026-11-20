import type { RefineContext } from "@conch/rpc";

import { describe, expect, it } from "vitest";

import { refineMessages, relevanceText } from "./refine.ts";

const REFINE: RefineContext = {
  chainId: "ask-1",
  spec: {
    formats: {},
    title: "Orders by status",
    version: 1,
    view: { kind: "pie", label: "status", value: "orders" },
  },
  sql: "select status, count(*) as orders from orders group by 1",
  turns: ["Orders by status", "this year"],
};

describe("refineMessages", () => {
  it("replays the turns, the previous SQL and the follow-up", () => {
    const messages = refineMessages(REFINE, "as a table");

    expect(messages.map((message) => message.role)).toStrictEqual([
      "user",
      "assistant",
      "user",
    ]);
    expect(messages[0]?.content).toBe("Orders by status\nThen: this year");
    expect(messages[1]?.content).toBe(REFINE.sql);
    expect(messages[2]?.content).toContain("follow-up: as a table");
    expect(messages[2]?.content).toContain('a pie titled "Orders by status"');
  });
});

describe("relevanceText", () => {
  it("joins the turns, the follow-up and the previous SQL", () => {
    expect(relevanceText(REFINE, "only paid")).toBe(
      `Orders by status\nthis year\nonly paid\n${REFINE.sql}`
    );
  });
});
