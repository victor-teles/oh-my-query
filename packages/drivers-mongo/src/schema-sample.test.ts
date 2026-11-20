import { Binary, Decimal128, Long, ObjectId, Timestamp } from "mongodb";
import { describe, expect, it } from "vitest";

import {
  bsonTypeName,
  MAX_SAMPLED_FIELDS,
  sampleFields,
} from "./schema-sample.ts";

describe("bsonTypeName", () => {
  it.each([
    [new ObjectId(), "objectId"],
    ["x", "string"],
    [1, "number"],
    [Long.fromNumber(1), "number"],
    [Decimal128.fromString("1.5"), "number"],
    [new Date(), "date"],
    [true, "bool"],
    [null, "null"],
    [{ a: 1 }, "object"],
    [[{ a: 1 }, { a: 2 }], "array<object>"],
    [["a", 1, "b"], "array<string>"],
    [[], "array"],
    [new Binary(new Uint8Array([1])), "binary"],
    [new Timestamp({ i: 1, t: 1 }), "timestamp"],
  ])("names %o as %s", (value, name) => {
    expect(bsonTypeName(value)).toBe(name);
  });
});

describe("sampleFields", () => {
  it("picks the dominant type and marks missing fields nullable", () => {
    const fields = sampleFields([
      { _id: new ObjectId(), note: "a", total: 1 },
      { _id: new ObjectId(), total: "2" },
      { _id: new ObjectId(), total: 3 },
    ]);
    expect(fields).toStrictEqual([
      {
        dataType: "objectId",
        defaultValue: null,
        isNullable: false,
        isPrimaryKey: true,
        name: "_id",
      },
      {
        dataType: "string",
        defaultValue: null,
        isNullable: true,
        isPrimaryKey: false,
        name: "note",
      },
      {
        dataType: "number",
        defaultValue: null,
        isNullable: false,
        isPrimaryKey: false,
        name: "total",
      },
    ]);
  });

  it("reads nested objects two levels deep, never deeper", () => {
    const fields = sampleFields([
      { address: { city: "Lisbon", geo: { lat: 1 } } },
    ]);
    expect(fields.map((field) => field.name)).toStrictEqual([
      "address",
      "address.city",
      "address.geo",
    ]);
  });

  it("caps the field count", () => {
    const document = Object.fromEntries(
      Array.from({ length: 60 }, (_, index) => [`f${index}`, index])
    );
    expect(sampleFields([document])).toHaveLength(MAX_SAMPLED_FIELDS);
  });
});
