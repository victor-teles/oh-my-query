import { describe, expect, it } from "vitest";

import { DbError } from "./error.ts";

describe("dbError", () => {
  it("sets name, code, and message from constructor", () => {
    const err = new DbError("X_CODE", "boom");
    expect(err.name).toBe("DbError");
    expect(err.code).toBe("X_CODE");
    expect(err.message).toBe("boom");
    expect(err).toBeInstanceOf(Error);
  });

  it("cancelled() has QUERY_CANCELLED code", () => {
    const err = DbError.cancelled();
    expect(err.code).toBe("QUERY_CANCELLED");
    expect(err.message).toBe("Query cancelled");
  });

  it("timeout() has QUERY_TIMEOUT code", () => {
    const err = DbError.timeout();
    expect(err.code).toBe("QUERY_TIMEOUT");
    expect(err.message).toMatch(/timeout/i);
  });

  it("unsupported(msg) has UNSUPPORTED code with custom message", () => {
    const err = DbError.unsupported("no streaming");
    expect(err.code).toBe("UNSUPPORTED");
    expect(err.message).toBe("no streaming");
  });

  it("fromUnknown returns the same DbError instance unchanged", () => {
    const original = new DbError("CUSTOM", "boom");
    expect(DbError.fromUnknown(original)).toBe(original);
  });

  it("fromUnknown wraps a plain Error using fallback code", () => {
    const err = DbError.fromUnknown(new Error("native err"), "WRAPPED");
    expect(err.code).toBe("WRAPPED");
    expect(err.message).toBe("native err");
    expect(err).toBeInstanceOf(DbError);
  });

  it("fromUnknown stringifies non-Error values", () => {
    const fromString = DbError.fromUnknown("oops");
    expect(fromString.code).toBe("UNKNOWN_ERROR");
    expect(fromString.message).toBe("oops");

    const fromNumber = DbError.fromUnknown(42, "NUM");
    expect(fromNumber.code).toBe("NUM");
    expect(fromNumber.message).toBe("42");
  });

  it("toJSON returns only code and message keys", () => {
    const err = new DbError("JSON_CODE", "json msg");
    const json = err.toJSON();
    expect(json).toStrictEqual({ code: "JSON_CODE", message: "json msg" });
    expect(Object.keys(json).toSorted()).toStrictEqual(["code", "message"]);
  });
});
