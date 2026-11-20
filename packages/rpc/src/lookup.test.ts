import { describe, expect, it } from "vitest";

import { LookupRequest, LookupValueSchema } from "./lookup.ts";

const UUID = "3f2a1b4c-9d8e-4f7a-b6c5-d4e3f2a1c91e";

const request = (value: unknown) => ({
  connectionId: "analytics",
  database: null,
  lookupId: "l1",
  value,
});

describe("lookupValueSchema", () => {
  it.each([
    { kind: "uuid", value: UUID },
    { kind: "email", value: "Ada@example.com" },
    { kind: "integer", value: "42" },
  ])("accepts a classified $kind", (value) => {
    expect(LookupValueSchema.parse(value)).toStrictEqual(value);
  });

  it.each([
    ["an uppercase UUID", { kind: "uuid", value: UUID.toUpperCase() }],
    ["a UUID labelled as an email", { kind: "email", value: UUID }],
    ["a malformed id", { kind: "integer", value: "042" }],
    ["SQL posing as an email", { kind: "email", value: "x' or 1=1 --" }],
    ["an oversize value", { kind: "email", value: `${"a".repeat(321)}@x.io` }],
    ["an unknown kind", { kind: "ulid", value: "01HZX" }],
  ])("rejects %s", (_label, value) => {
    expect(LookupValueSchema.safeParse(value).success).toBeFalsy();
  });
});

describe("lookupRequest", () => {
  it("accepts a well-formed request", () => {
    expect(
      LookupRequest.parse(request({ kind: "uuid", value: UUID }))
    ).toMatchObject({ lookupId: "l1", value: { kind: "uuid" } });
  });

  it.each([
    ["an empty lookup id", { lookupId: "" }],
    ["a long connection id", { connectionId: "c".repeat(201) }],
    ["a long database", { database: "d".repeat(501) }],
  ])("rejects %s", (_label, override) => {
    expect(
      LookupRequest.safeParse({
        ...request({ kind: "integer", value: "42" }),
        ...override,
      }).success
    ).toBeFalsy();
  });
});
