import { describe, expect, it } from "vitest";

import { classifyLookupValue } from "./lookup-value.ts";

const UUID = "3f2a1b4c-9d8e-4f7a-b6c5-d4e3f2a1c91e";

describe("classifyLookupValue", () => {
  it.each([
    ["a canonical UUID", UUID, UUID],
    ["an uppercase UUID", UUID.toUpperCase(), UUID],
    ["a braced UUID", `{${UUID}}`, UUID],
    ["a quoted UUID", `"${UUID}"`, UUID],
    ["a UUID without dashes", UUID.replaceAll("-", ""), UUID],
    ["a UUID with surrounding space", `  ${UUID}\t`, UUID],
  ])("reads %s", (_label, raw, value) => {
    expect(classifyLookupValue(raw)).toStrictEqual({ kind: "uuid", value });
  });

  it.each([
    ["a plain email", "ada@example.com", "ada@example.com"],
    [
      "a plus-addressed email",
      "ada+ops@example.co.uk",
      "ada+ops@example.co.uk",
    ],
    ["a quoted email", "'Ada@Example.com'", "Ada@Example.com"],
    ["an angle-bracketed email", "<ada@example.com>", "ada@example.com"],
    ["a mailto link", "mailto:ada@example.com", "ada@example.com"],
  ])("reads %s and keeps its case", (_label, raw, value) => {
    expect(classifyLookupValue(raw)).toStrictEqual({ kind: "email", value });
  });

  it.each([
    ["1", "1"],
    ["42", "42"],
    ["the int64 maximum", "9223372036854775807"],
    ["a backticked id", "`42`"],
  ])("reads %s as an integer", (_label, raw) => {
    expect(classifyLookupValue(raw)).toMatchObject({ kind: "integer" });
  });

  it.each([
    ["an invalid hex digit", UUID.replace("3f", "3g")],
    ["a short UUID", UUID.slice(0, -1)],
    ["an email without a TLD", "ada@localhost"],
    ["an email with a one-letter TLD", "ada@example.c"],
    ["an email with two @", "ada@ops@example.com"],
    ["an email with a long local part", `${"a".repeat(65)}@example.com`],
    ["an email with a space", "ada lovelace@example.com"],
    ["int64 maximum + 1", "9223372036854775808"],
    ["a leading zero", "042"],
    ["a negative number", "-42"],
    ["a decimal", "4.2"],
    ["an exponent", "1e5"],
    ["zero", "0"],
    ["prose", "find the user"],
    ["an empty string", "   "],
    ["empty quotes", '""'],
    ["a line break", `${UUID}\n`],
    ["321 characters", `${"a".repeat(309)}@example.com`],
  ])("rejects %s", (_label, raw) => {
    expect(classifyLookupValue(raw)).toBeNull();
  });
});
