import { describe, expect, it } from "vitest";

import { decodePng } from "./clipboard-image.ts";

const PNG_HEADER = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);

describe("decodePng", () => {
  it("returns the bytes of a base64 PNG", () => {
    const bytes = decodePng(PNG_HEADER.toString("base64"));
    expect([...bytes]).toStrictEqual([...PNG_HEADER]);
  });

  it.each([
    ["a non-string", 42],
    ["an empty string", ""],
    ["non-base64 text", "not base64!"],
    ["a JPEG", Buffer.from([255, 216, 255, 224]).toString("base64")],
  ])("rejects %s", (_label, input) => {
    expect(() => decodePng(input)).toThrow(
      expect.objectContaining({ code: "INVALID_IMAGE" })
    );
  });
});
