import { DbError } from "@oh-my-query/core";
import { decodeRpcError, encodeRpcError } from "@oh-my-query/rpc";
import { describe, expect, it } from "vitest";

const sendOverWire = (err: unknown): Error => {
  try {
    encodeRpcError(err);
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error;
    }
    // Electrobun strips everything but `error.message`, so simulate the wire
    // by reconstructing a plain Error with just the message string.
    return new Error(error.message);
  }
  throw new Error("encodeRpcError should always throw");
};

describe("rpc error round-trip", () => {
  it("preserves DbError code, message, and name across the wire", () => {
    const original = new DbError("QUERY_CANCELLED", "Query cancelled");
    const decoded = decodeRpcError(sendOverWire(original)) as Error & {
      code?: string;
    };

    expect(decoded.message).toBe("Query cancelled");
    expect(decoded.code).toBe("QUERY_CANCELLED");
    expect(decoded.name).toBe("DbError");
  });

  it("passes plain Errors through untouched", () => {
    const original = new Error("plain failure");
    const decoded = decodeRpcError(sendOverWire(original));

    expect(decoded).toBeInstanceOf(Error);
    expect((decoded as Error).message).toBe("plain failure");
    expect((decoded as Error & { code?: unknown }).code).toBeUndefined();
  });

  it("returns non-Error values from decodeRpcError unchanged", () => {
    expect(decodeRpcError("plain string")).toBe("plain string");
    expect(decodeRpcError(null)).toBeNull();
  });

  it("returns malformed-prefix errors unchanged", () => {
    const malformed = new Error("__omq_err__not-json");
    expect(decodeRpcError(malformed)).toBe(malformed);
  });

  it("flattens AggregateError so the inner socket failure surfaces", () => {
    const innerA = Object.assign(new Error("connect ECONNREFUSED ::1:5432"), {
      code: "ECONNREFUSED",
    });
    const innerB = Object.assign(
      new Error("connect ECONNREFUSED 127.0.0.1:5432"),
      { code: "ECONNREFUSED" }
    );
    const aggregate = new AggregateError([innerA, innerB], "connect failed");

    const decoded = decodeRpcError(sendOverWire(aggregate)) as Error & {
      code?: string;
    };

    expect(decoded.message).toContain("ECONNREFUSED ::1:5432");
    expect(decoded.message).toContain("ECONNREFUSED 127.0.0.1:5432");
    expect(decoded.code).toBe("ECONNREFUSED");
    expect(decoded.name).toBe("DbError");
  });

  it("flattens AggregateError with no inner errors using the aggregate's own message", () => {
    const aggregate = new AggregateError([], "All connect attempts failed");

    const decoded = decodeRpcError(sendOverWire(aggregate)) as Error & {
      code?: string;
    };

    expect(decoded.message).toBe("All connect attempts failed");
    expect(decoded.code).toBe("DB_ERROR");
  });

  it("never leaks [object Object] when sub-errors are plain objects", () => {
    const aggregate = new AggregateError(
      [{ code: "ECONNREFUSED", port: 5432 }, { weird: true }],
      "connect failed"
    );

    const decoded = decodeRpcError(sendOverWire(aggregate)) as Error & {
      code?: string;
    };

    expect(decoded.message).not.toContain("[object Object]");
    expect(decoded.message).toContain("ECONNREFUSED");
    expect(decoded.code).toBe("ECONNREFUSED");
  });
});
