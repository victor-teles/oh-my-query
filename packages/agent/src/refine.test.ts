import type { RefineContext } from "@oh-my-query/rpc";

import { CARD_SPEC_VERSION } from "@oh-my-query/rpc";
import { describe, expect, it } from "vitest";

import { mongoEngine } from "./mongo-engine.ts";
import { refineMessages, relevanceText } from "./refine.ts";
import { sqlEngine } from "./sql-engine.ts";

const REFINE: RefineContext = {
  chainId: "ask-1",
  spec: {
    formats: {},
    title: "Orders by status",
    version: CARD_SPEC_VERSION,
    view: { kind: "pie", label: "status", value: "orders" },
  },
  sql: "select status, count(*) as orders from orders group by 1",
  turns: ["Orders by status", "this year"],
};

describe("refineMessages", () => {
  it("replays the turns, the previous SQL and the follow-up", () => {
    const messages = refineMessages(
      REFINE,
      "as a table",
      sqlEngine("postgresql")
    );

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

  it("asks for the engine's reply format", () => {
    const sql = refineMessages(REFINE, "this month", sqlEngine("postgresql"));
    const mongo = refineMessages(REFINE, "this month", mongoEngine);
    expect(sql[2]?.content).toContain("Change that query");
    expect(sql[2]?.content).toContain("reply with SQL only.");
    expect(mongo[2]?.content).toContain("Change that pipeline");
    expect(mongo[2]?.content).toContain("reply with JSON only.");
  });
});

describe("relevanceText", () => {
  it("joins the turns, the follow-up and the previous SQL", () => {
    expect(relevanceText(REFINE, "only paid")).toBe(
      `Orders by status\nthis year\nonly paid\n${REFINE.sql}`
    );
  });
});
