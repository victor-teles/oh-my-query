import { describe, expect, it } from "vitest";

import { makeConnection } from "@/test/connection-fixture";

import { commitToken } from "./connection-token";

const analytics = makeConnection({ id: "analytics", name: "analytics" });
const billing = makeConnection({ id: "billing", name: "billing" });
const billingStaging = makeConnection({
  id: "billing-staging",
  name: "billing-staging",
});
const connections = [analytics, billing, billingStaging];

describe("commitToken", () => {
  it("commits a unique prefix followed by a space", () => {
    expect(commitToken("@anal ", connections)).toBe(analytics);
  });

  it("commits an exact name even when it is also a prefix of another", () => {
    expect(commitToken("@billing ", connections)).toBe(billing);
  });

  it.each([
    ["an ambiguous prefix", "@bill "],
    ["no trailing space", "@anal"],
    ["no match", "@zzz "],
    ["a bare @", "@ "],
    ["more words", "@anal x "],
    ["plain text", "analytics "],
  ])("does not commit %s", (_label, value) => {
    expect(commitToken(value, connections)).toBeNull();
  });
});
