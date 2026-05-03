import { describe, expect, it } from "vitest";

import { classifyStandardSql, normalizeSqlForAnalysis } from "./safe-mode.ts";

describe("destructive SQL classification", () => {
  it("flags DROP statements", () => {
    expect(classifyStandardSql("DROP TABLE users")).toMatchObject({
      keyword: "DROP",
      kind: "drop",
    });
  });

  it("flags TRUNCATE statements", () => {
    expect(classifyStandardSql("truncate table logs")).toMatchObject({
      kind: "truncate",
    });
  });

  it("flags ALTER statements", () => {
    expect(
      classifyStandardSql("alter table users drop column email")
    ).toMatchObject({ kind: "alter" });
  });

  it("flags DELETE without WHERE", () => {
    expect(classifyStandardSql("DELETE FROM users")).toMatchObject({
      kind: "delete",
    });
  });

  it("accepts DELETE with WHERE", () => {
    expect(classifyStandardSql("DELETE FROM users WHERE id = 1")).toBeNull();
  });

  it("flags UPDATE without WHERE", () => {
    expect(classifyStandardSql("UPDATE users SET active = 0")).toMatchObject({
      kind: "update",
    });
  });

  it("accepts UPDATE with WHERE", () => {
    expect(
      classifyStandardSql("UPDATE users SET active = 0 WHERE id = 1")
    ).toBeNull();
  });

  it("ignores destructive keywords inside line comments", () => {
    expect(classifyStandardSql("SELECT 1 -- DROP TABLE users")).toBeNull();
  });

  it("ignores destructive keywords inside block comments", () => {
    expect(classifyStandardSql("/* DROP TABLE users */ SELECT 1")).toBeNull();
  });

  it("ignores destructive keywords inside string literals", () => {
    expect(classifyStandardSql("SELECT 'DROP TABLE users'")).toBeNull();
  });

  it("ignores destructive keywords inside dollar-quoted strings", () => {
    expect(classifyStandardSql("SELECT $$DELETE FROM users$$")).toBeNull();
  });

  it("returns null for plain SELECTs", () => {
    expect(classifyStandardSql("SELECT * FROM users")).toBeNull();
  });

  it("reports DROP before an unscoped DELETE when both appear", () => {
    expect(
      classifyStandardSql("DROP TABLE tmp; DELETE FROM users")
    ).toMatchObject({ kind: "drop" });
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
