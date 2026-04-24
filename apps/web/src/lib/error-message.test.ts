import { describe, expect, it } from "vitest";

import { getErrorMessage } from "./error-message";

describe("getErrorMessage", () => {
  it("returns the message of a standard Error", () => {
    expect(getErrorMessage(new Error("boom"), "fallback")).toBe("boom");
  });

  it("returns the message field from a Tauri DbError-shaped object", () => {
    expect(
      getErrorMessage({ code: "DB_ERROR", message: "connection lost" }, "fb")
    ).toBe("connection lost");
  });

  it("returns a plain string error as-is", () => {
    expect(getErrorMessage("kaput", "fallback")).toBe("kaput");
  });

  it("falls back when the error has no usable shape", () => {
    expect(getErrorMessage(null, "fallback")).toBe("fallback");
    expect(getErrorMessage(undefined, "fallback")).toBe("fallback");
    expect(getErrorMessage(42, "fallback")).toBe("fallback");
  });

  it("stringifies non-string message fields", () => {
    expect(getErrorMessage({ message: 500 }, "fallback")).toBe("500");
  });
});
