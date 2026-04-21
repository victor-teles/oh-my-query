import { describe, expect, it } from "vitest";

import { classifyError } from "@/lib/query-error";

describe("query error classifier", () => {
  it("classifies by known Postgres syntax code", () => {
    expect(classifyError("", "42601").category).toBe("syntax");
  });

  it("classifies by known MySQL duplicate key code", () => {
    expect(classifyError("", "1062").category).toBe("constraint");
  });

  it("classifies TLS_ERROR as connection", () => {
    expect(classifyError("", "TLS_ERROR").category).toBe("connection");
  });

  it("falls through to message classification when code is Mongo/Redis/Clickhouse", () => {
    expect(
      classifyError("syntax error near FROM", "MONGO_ERROR").category
    ).toBe("syntax");
  });

  it("classifies timeout messages", () => {
    expect(
      classifyError("canceling statement due to statement timeout", null)
        .category
    ).toBe("timeout");
  });

  it("classifies connection refused messages", () => {
    expect(classifyError("connection refused", null).category).toBe(
      "connection"
    );
  });

  it("classifies permission denied messages", () => {
    expect(
      classifyError("permission denied for table users", null).category
    ).toBe("permission");
  });

  it("classifies missing relation as not-found", () => {
    expect(
      classifyError('relation "users" does not exist', null).category
    ).toBe("not-found");
  });

  it("classifies unique constraint as constraint", () => {
    expect(
      classifyError("duplicate key value violates unique constraint", null)
        .category
    ).toBe("constraint");
  });

  it("returns unknown when nothing matches", () => {
    const result = classifyError("something weird happened", null);
    expect(result.category).toBe("unknown");
    expect(result.label).toBe("Error");
  });

  it("attaches label, summary, and hint for each category", () => {
    const result = classifyError("", "42601");
    expect(result.label).toBe("Syntax");
    expect(result.summary).toMatch(/syntax error/i);
    expect(result.hint).toMatch(/line/i);
  });

  it("prefers code over message when both match different categories", () => {
    expect(classifyError("connection refused", "42601").category).toBe(
      "syntax"
    );
  });
});
