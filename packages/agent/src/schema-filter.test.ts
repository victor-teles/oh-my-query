import type { SchemaInfo, TableItem } from "@oh-my-query/core";

import { describe, expect, it } from "vitest";

import { selectRelevantSchema } from "./schema-filter.ts";
import { largeSchema, table } from "./test-fixtures.ts";

const names = (schema: SchemaInfo): string[] =>
  schema.schemas.flatMap((item) => item.tables.map((t: TableItem) => t.name));

describe("selectRelevantSchema", () => {
  it("leaves schemas at or under 150 tables untouched", () => {
    const schema = largeSchema(150);
    const result = selectRelevantSchema(schema, "revenue by region");
    expect(result.schema).toBe(schema);
    expect(result.omittedTables).toBe(0);
  });

  it("keeps the most relevant tables of a 300-table schema plus their foreign-key neighbors", () => {
    const result = selectRelevantSchema(
      largeSchema(300),
      "Monthly revenue by region"
    );
    const kept = names(result.schema);

    expect(kept).toStrictEqual(
      expect.arrayContaining(["revenue_events", "regions", "accounts"])
    );
    expect(kept.length).toBeLessThanOrEqual(80);
    expect(kept.length).toBeGreaterThanOrEqual(40);
    expect(result.omittedTables).toBe(303 - kept.length);
  });

  it("fills the remaining slots with the largest tables when nothing matches", () => {
    const schema = largeSchema(200, [table("zz_huge", [], 10_000_000)]);
    const kept = names(selectRelevantSchema(schema, "?").schema);
    expect(kept).toContain("zz_huge");
    expect(kept).toHaveLength(40);
  });
});
