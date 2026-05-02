import { describe, expect, it } from "vitest";

import {
  classifyDestructiveSql,
  normalizeSqlForAnalysis,
} from "@/lib/safe-mode";

describe("destructive SQL classification", () => {
  it("flags DROP statements", () => {
    expect(classifyDestructiveSql("DROP TABLE users")).toMatchObject({
      keyword: "DROP",
      kind: "drop",
    });
  });

  it("flags TRUNCATE statements", () => {
    expect(classifyDestructiveSql("truncate table logs")).toMatchObject({
      kind: "truncate",
    });
  });

  it("flags ALTER statements", () => {
    expect(
      classifyDestructiveSql("alter table users drop column email")
    ).toMatchObject({ kind: "alter" });
  });

  it("flags DELETE without WHERE", () => {
    expect(classifyDestructiveSql("DELETE FROM users")).toMatchObject({
      kind: "delete",
    });
  });

  it("accepts DELETE with WHERE", () => {
    expect(classifyDestructiveSql("DELETE FROM users WHERE id = 1")).toBeNull();
  });

  it("flags UPDATE without WHERE", () => {
    expect(classifyDestructiveSql("UPDATE users SET active = 0")).toMatchObject(
      { kind: "update" }
    );
  });

  it("accepts UPDATE with WHERE", () => {
    expect(
      classifyDestructiveSql("UPDATE users SET active = 0 WHERE id = 1")
    ).toBeNull();
  });

  it("ignores destructive keywords inside line comments", () => {
    expect(classifyDestructiveSql("SELECT 1 -- DROP TABLE users")).toBeNull();
  });

  it("ignores destructive keywords inside block comments", () => {
    expect(
      classifyDestructiveSql("/* DROP TABLE users */ SELECT 1")
    ).toBeNull();
  });

  it("ignores destructive keywords inside string literals", () => {
    expect(classifyDestructiveSql("SELECT 'DROP TABLE users'")).toBeNull();
  });

  it("ignores destructive keywords inside dollar-quoted strings", () => {
    expect(classifyDestructiveSql("SELECT $$DELETE FROM users$$")).toBeNull();
  });

  it("returns null for plain SELECTs", () => {
    expect(classifyDestructiveSql("SELECT * FROM users")).toBeNull();
  });

  it("reports DROP before an unscoped DELETE when both appear", () => {
    expect(
      classifyDestructiveSql("DROP TABLE tmp; DELETE FROM users")
    ).toMatchObject({ kind: "drop" });
  });
});

describe("mongoDB classification", () => {
  it("flags deleteMany with empty filter", () => {
    expect(
      classifyDestructiveSql("db.users.deleteMany({})", "mongodb")
    ).toMatchObject({ keyword: "deleteMany", kind: "delete" });
  });

  it("flags deleteMany with no filter argument", () => {
    expect(
      classifyDestructiveSql("db.users.deleteMany()", "mongodb")
    ).toMatchObject({ kind: "delete" });
  });

  it("flags deleteOne with empty filter", () => {
    expect(
      classifyDestructiveSql("db.users.deleteOne({})", "mongodb")
    ).toMatchObject({ keyword: "deleteOne", kind: "delete" });
  });

  it("flags remove with empty filter", () => {
    expect(
      classifyDestructiveSql("db.users.remove({})", "mongodb")
    ).toMatchObject({ keyword: "remove", kind: "delete" });
  });

  it("flags drop()", () => {
    expect(classifyDestructiveSql("db.users.drop()", "mongodb")).toMatchObject({
      keyword: "drop",
      kind: "drop",
    });
  });

  it("flags dropCollection()", () => {
    expect(
      classifyDestructiveSql('db.dropCollection("users")', "mongodb")
    ).toMatchObject({ keyword: "drop", kind: "drop" });
  });

  it("flags dropDatabase()", () => {
    expect(
      classifyDestructiveSql("db.dropDatabase()", "mongodb")
    ).toMatchObject({ keyword: "dropDatabase", kind: "drop" });
  });

  it("does not flag deleteMany with a non-empty filter", () => {
    expect(
      classifyDestructiveSql(
        'db.users.deleteMany({ status: "inactive" })',
        "mongodb"
      )
    ).toBeNull();
  });

  it("does not flag a plain find query", () => {
    expect(
      classifyDestructiveSql('db.users.find({ name: "alice" })', "mongodb")
    ).toBeNull();
  });

  it("does not apply SQL classification to mongodb dialect", () => {
    expect(classifyDestructiveSql("DROP TABLE users", "mongodb")).toBeNull();
  });
});

describe("redis classification", () => {
  it("flags FLUSHALL", () => {
    expect(classifyDestructiveSql("FLUSHALL", "redis")).toMatchObject({
      keyword: "FLUSHALL",
      kind: "drop",
    });
  });

  it("flags FLUSHDB", () => {
    expect(classifyDestructiveSql("FLUSHDB", "redis")).toMatchObject({
      keyword: "FLUSHDB",
      kind: "drop",
    });
  });

  it("flags FLUSHDB case-insensitively", () => {
    expect(classifyDestructiveSql("flushdb", "redis")).toMatchObject({
      kind: "drop",
    });
  });

  it("flags DEL *", () => {
    expect(classifyDestructiveSql("DEL *", "redis")).toMatchObject({
      keyword: "DEL *",
      kind: "delete",
    });
  });

  it("does not flag a targeted DEL command", () => {
    expect(classifyDestructiveSql("DEL session:abc123", "redis")).toBeNull();
  });

  it("does not flag GET commands", () => {
    expect(classifyDestructiveSql("GET mykey", "redis")).toBeNull();
  });

  it("does not apply SQL classification to redis dialect", () => {
    expect(classifyDestructiveSql("DROP TABLE users", "redis")).toBeNull();
  });
});

describe("sQL normalization", () => {
  it("strips line comments", () => {
    expect(normalizeSqlForAnalysis("SELECT 1 -- hi")).not.toMatch(/hi/);
  });

  it("strips block comments", () => {
    expect(normalizeSqlForAnalysis("/* hi */ SELECT 1")).not.toMatch(/hi/);
  });

  it("preserves doubled single quotes inside strings", () => {
    const normalized = normalizeSqlForAnalysis("SELECT 'it''s fine'");
    expect(normalized).not.toMatch(/fine/);
  });
});
