import { describe, expect, it } from "vitest";

import { getDestructiveClassifier } from "./safe-mode.ts";

const SQL_TYPES = [
  "postgresql",
  "mysql",
  "sqlite",
  "mssql",
  "clickhouse",
  "duckdb",
];

describe("getDestructiveClassifier", () => {
  it.each(SQL_TYPES)("classifies SQL DROP for %s", (type) => {
    expect(getDestructiveClassifier(type)("DROP TABLE users")).toMatchObject({
      kind: "drop",
    });
  });

  it("dispatches MongoDB rules", () => {
    const classify = getDestructiveClassifier("mongodb");
    expect(classify("db.users.deleteMany({})")).toMatchObject({
      kind: "delete",
    });
    expect(classify("DROP TABLE users")).toBeNull();
  });

  it("dispatches Redis rules", () => {
    const classify = getDestructiveClassifier("redis");
    expect(classify("FLUSHALL")).toMatchObject({ kind: "drop" });
    expect(classify("DROP TABLE users")).toBeNull();
  });

  it("throws for an unknown dbType", () => {
    expect(() => getDestructiveClassifier("oracle")).toThrow(
      /Unknown database type/
    );
  });
});
