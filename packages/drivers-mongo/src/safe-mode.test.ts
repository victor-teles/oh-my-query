import { describe, expect, it } from "vitest";

import { classifyDestructive } from "./safe-mode.ts";

describe("mongoDB classification", () => {
  it("flags deleteMany with empty filter", () => {
    expect(classifyDestructive("db.users.deleteMany({})")).toMatchObject({
      keyword: "deleteMany",
      kind: "delete",
    });
  });

  it("flags deleteMany with no filter argument", () => {
    expect(classifyDestructive("db.users.deleteMany()")).toMatchObject({
      kind: "delete",
    });
  });

  it("flags deleteOne with empty filter", () => {
    expect(classifyDestructive("db.users.deleteOne({})")).toMatchObject({
      keyword: "deleteOne",
      kind: "delete",
    });
  });

  it("flags remove with empty filter", () => {
    expect(classifyDestructive("db.users.remove({})")).toMatchObject({
      keyword: "remove",
      kind: "delete",
    });
  });

  it("flags drop()", () => {
    expect(classifyDestructive("db.users.drop()")).toMatchObject({
      keyword: "drop",
      kind: "drop",
    });
  });

  it("flags dropCollection()", () => {
    expect(classifyDestructive('db.dropCollection("users")')).toMatchObject({
      keyword: "drop",
      kind: "drop",
    });
  });

  it("flags dropDatabase()", () => {
    expect(classifyDestructive("db.dropDatabase()")).toMatchObject({
      keyword: "dropDatabase",
      kind: "drop",
    });
  });

  it("does not flag deleteMany with a non-empty filter", () => {
    expect(
      classifyDestructive('db.users.deleteMany({ status: "inactive" })')
    ).toBeNull();
  });

  it("does not flag a plain find query", () => {
    expect(classifyDestructive('db.users.find({ name: "alice" })')).toBeNull();
  });

  it("does not flag SQL DROP statements", () => {
    expect(classifyDestructive("DROP TABLE users")).toBeNull();
  });
});
