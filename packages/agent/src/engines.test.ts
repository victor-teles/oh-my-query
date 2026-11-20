import type { SchemaInfo } from "@oh-my-query/core";

import { describe, expect, it } from "vitest";

import { mongoEngine } from "./mongo-engine.ts";
import {
  refineInstruction,
  repairInstruction,
  sqlSystemPrompt,
} from "./prompts.ts";
import { redisEngine } from "./redis-engine.ts";
import { formatSchemaForPrompt } from "./schema-prompt.ts";
import { sqlEngine } from "./sql-engine.ts";
import { column, table } from "./test-fixtures.ts";

const input = {
  connectionLabel: "shop",
  schemaText: "orders (≈12 docs): _id objectId",
  today: new Date("2026-11-20T09:00:00Z"),
};

const schema: SchemaInfo = {
  schemas: [
    {
      name: "public",
      tables: [table("orders", [], 12, [column("id"), column("status")])],
      views: [],
    },
  ],
};

describe("sqlEngine", () => {
  const engine = sqlEngine("postgresql");

  it("names its dialect and progress", () => {
    expect([engine.language, engine.label, engine.writingDetail]).toStrictEqual(
      ["postgresql", "PostgreSQL", "Writing SQL"]
    );
  });

  it("keeps the SQL prompts byte for byte", () => {
    expect(engine.systemPrompt(input)).toBe(
      sqlSystemPrompt({ ...input, dialect: "postgresql" })
    );
    expect(engine.repairInstruction("boom")).toBe(repairInstruction("boom"));
    expect(
      engine.refineInstruction("as a table", { title: "t", view: "pie" })
    ).toBe(refineInstruction("as a table", { title: "t", view: "pie" }));
    expect(engine.formatSchema(schema, {})).toBe(
      formatSchemaForPrompt(schema, "postgresql", {})
    );
  });

  it("guards with the SQL read-only check", () => {
    expect(engine.guard("select 1")).toStrictEqual({ ok: true });
    expect(engine.guard("delete from orders")).toMatchObject({ ok: false });
  });
});

describe("mongoEngine", () => {
  it.each([
    'You write one read-only MongoDB aggregation that answers a question about the "shop" database.',
    '"collection": "<name>", "pipeline": [ … ]',
    "Indent the JSON with two spaces.",
    "$match, $project",
    "Never use $out, $merge, $function, $accumulator or $where.",
    '{"$date": "2026-01-01T00:00:00Z"}',
    "Today is 2026-11-20.",
    "orders (≈12 docs): _id objectId",
  ])("puts %s in the system prompt", (text) => {
    expect(mongoEngine.systemPrompt(input)).toContain(text);
  });

  it("never offers $facet", () => {
    expect(mongoEngine.systemPrompt(input)).not.toContain("$facet");
  });

  it("guards with the pipeline allowlist", () => {
    expect(
      mongoEngine.guard(
        JSON.stringify({ collection: "orders", pipeline: [{ $limit: 5 }] })
      )
    ).toStrictEqual({ ok: true });
    expect(
      mongoEngine.guard(
        JSON.stringify({ collection: "orders", pipeline: [{ $out: "x" }] })
      )
    ).toStrictEqual({
      ok: false,
      reason: "$out writes data; only read-only pipelines can run here.",
    });
  });

  it("repairs and refines in JSON", () => {
    expect(mongoEngine.repairInstruction("bad stage")).toBe(
      "That pipeline failed with this error:\nbad stage\n\nWrite a corrected pipeline for the same question. Follow the same rules and reply with JSON only."
    );
    expect(
      mongoEngine.refineInstruction("this year", { title: "t", view: "table" })
    ).toContain("Change that pipeline to answer this follow-up: this year");
  });
});

describe("redisEngine", () => {
  const prompt = redisEngine.systemPrompt({
    ...input,
    schemaText: "session:* (hash, ≈3,400 keys): user_id",
  });

  it.each([
    '{"kind": "commands"',
    '{"kind": "scan"',
    "MEMORY USAGE",
    "Use a scan plan to count or size keys; never KEYS.",
    "session:* (hash, ≈3,400 keys): user_id",
  ])("puts %s in the system prompt", (text) => {
    expect(prompt).toContain(text);
  });

  it("never offers a write command", () => {
    expect(prompt).not.toMatch(/\b(?:SET|DEL|EVAL|FLUSHALL)\b/);
  });

  it("guards with the command allowlist", () => {
    expect(
      redisEngine.guard(
        JSON.stringify({ commands: [["DBSIZE"]], kind: "commands" })
      )
    ).toStrictEqual({ ok: true });
    expect(
      redisEngine.guard(
        JSON.stringify({ commands: [["FLUSHALL"]], kind: "commands" })
      )
    ).toStrictEqual({
      ok: false,
      reason: "FLUSHALL deletes data; only read commands can run here.",
    });
  });

  it("names its language and progress", () => {
    expect([
      redisEngine.language,
      redisEngine.writingDetail,
      mongoEngine.writingDetail,
    ]).toStrictEqual(["redis", "Writing the commands", "Writing the pipeline"]);
    expect(redisEngine.repairInstruction("x")).toContain(
      "That plan failed with this error"
    );
  });
});
