import { describe, expect, it } from "vitest";

import { flattenRecords } from "./flatten.ts";

const options = { isTruncated: false, maxColumns: 30 };

describe("flattenRecords", () => {
  it("unions keys in first-seen order and fills gaps with null", () => {
    const result = flattenRecords(
      [
        { orders: 4, status: "paid" },
        { refunded: true, status: "refunded" },
      ],
      options
    );
    expect(result.columns.map((column) => column.name)).toStrictEqual([
      "orders",
      "status",
      "refunded",
    ]);
    expect(result.rows).toStrictEqual([
      [4, "paid", null],
      [null, "refunded", true],
    ]);
    expect(result).toMatchObject({
      isTruncated: false,
      resultType: "tabular",
      rowCount: 2,
    });
  });

  it("flattens one level of nesting and encodes deeper values as JSON", () => {
    const result = flattenRecords(
      [
        {
          address: { city: "Lisbon", geo: { lat: 38.7 } },
          empty: {},
          tags: ["a", "b"],
        },
      ],
      options
    );
    expect(result.columns).toStrictEqual([
      { name: "address.city", typeName: "TEXT" },
      { name: "address.geo", typeName: "JSON" },
      { name: "empty", typeName: "JSON" },
      { name: "tags", typeName: "JSON" },
    ]);
    expect(result.rows[0]).toStrictEqual([
      "Lisbon",
      '{"lat":38.7}',
      "{}",
      '["a","b"]',
    ]);
  });

  it("infers numeric, boolean, timestamp and text columns", () => {
    const result = flattenRecords(
      [
        {
          at: "2026-01-01T00:00:00.000Z",
          day: "2026-01-02",
          mixed: 1,
          n: 1.5,
          ok: true,
        },
        {
          at: "2026-02-01T10:00:00Z",
          day: null,
          mixed: "two",
          n: 2,
          ok: false,
        },
      ],
      options
    );
    expect(
      Object.fromEntries(result.columns.map((c) => [c.name, c.typeName]))
    ).toStrictEqual({
      at: "TIMESTAMP",
      day: "TIMESTAMP",
      mixed: "TEXT",
      n: "NUMERIC",
      ok: "BOOLEAN",
    });
  });

  it("calls an all-null column text", () => {
    const result = flattenRecords([{ note: null }, {}], options);
    expect(result.columns).toStrictEqual([{ name: "note", typeName: "TEXT" }]);
    expect(result.rows).toStrictEqual([[null], [null]]);
  });

  it("caps the number of columns", () => {
    const record = Object.fromEntries(
      Array.from({ length: 40 }, (_, index) => [`c${index}`, index])
    );
    const result = flattenRecords([record], { ...options, maxColumns: 30 });
    expect(result.columns).toHaveLength(30);
    expect(result.rows[0]).toHaveLength(30);
    expect(result.columns.at(-1)?.name).toBe("c29");
  });

  it("keeps _id first when present", () => {
    const result = flattenRecords(
      [
        Object.fromEntries([
          ["status", "paid"],
          ["_id", "65f1c0ffee0000000000abcd"],
        ]),
      ],
      options
    );
    expect(result.columns[0]?.name).toBe("_id");
  });

  it("normalises scalars that are not JSON-safe", () => {
    const result = flattenRecords(
      [
        {
          big: 12n,
          bigger: 2n ** 70n,
          infinite: Number.POSITIVE_INFINITY,
          missing: undefined,
          symbol: Symbol.for("x"),
          when: new Date("2026-03-01T00:00:00Z"),
        },
      ],
      options
    );
    expect(result.rows[0]).toStrictEqual([
      12,
      "1180591620717411303424",
      "Infinity",
      null,
      "Symbol(x)",
      "2026-03-01T00:00:00.000Z",
    ]);
  });

  it("encodes bigints inside nested values", () => {
    const result = flattenRecords([{ deep: { a: { b: 3n } } }], options);
    expect(result.rows[0]).toStrictEqual(['{"b":"3"}']);
  });

  it("passes the truncation flag through", () => {
    expect(
      flattenRecords([{ a: 1 }], { ...options, isTruncated: true }).isTruncated
    ).toBeTruthy();
  });
});
