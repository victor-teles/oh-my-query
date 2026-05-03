import { describe, expect, it } from "vitest";

import { classifyDestructive } from "./safe-mode.ts";

describe("redis classification", () => {
  it("flags FLUSHALL", () => {
    expect(classifyDestructive("FLUSHALL")).toMatchObject({
      keyword: "FLUSHALL",
      kind: "drop",
    });
  });

  it("flags FLUSHDB", () => {
    expect(classifyDestructive("FLUSHDB")).toMatchObject({
      keyword: "FLUSHDB",
      kind: "drop",
    });
  });

  it("flags FLUSHDB case-insensitively", () => {
    expect(classifyDestructive("flushdb")).toMatchObject({ kind: "drop" });
  });

  it("flags DEL *", () => {
    expect(classifyDestructive("DEL *")).toMatchObject({
      keyword: "DEL *",
      kind: "delete",
    });
  });

  it("does not flag a targeted DEL command", () => {
    expect(classifyDestructive("DEL session:abc123")).toBeNull();
  });

  it("does not flag DEL on a key that merely starts with *", () => {
    expect(classifyDestructive("DEL *abc")).toBeNull();
  });

  it("does not flag GET commands", () => {
    expect(classifyDestructive("GET mykey")).toBeNull();
  });

  it("does not flag SQL DROP statements", () => {
    expect(classifyDestructive("DROP TABLE users")).toBeNull();
  });
});
