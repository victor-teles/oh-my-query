import { sql } from "@codemirror/lang-sql";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import type { SchemaInfo } from "@/lib/tauri";

import {
  createColumnCompletionSource,
  createTableCompletionSource,
  getDefaultSchema,
  schemaInfoToSQLNamespace,
} from "./sql-schema";

const schema: SchemaInfo = {
  schemas: [
    {
      name: "public",
      tables: [
        {
          columns: [
            {
              dataType: "int4",
              defaultValue: null,
              isNullable: false,
              isPrimaryKey: true,
              name: "id",
            },
            {
              dataType: "text",
              defaultValue: null,
              isNullable: false,
              isPrimaryKey: false,
              name: "email",
            },
          ],
          foreignKeys: [],
          indexes: [],
          name: "users",
          rowEstimate: null,
        },
        {
          columns: [
            {
              dataType: "int4",
              defaultValue: null,
              isNullable: false,
              isPrimaryKey: true,
              name: "id",
            },
            {
              dataType: "int4",
              defaultValue: null,
              isNullable: false,
              isPrimaryKey: false,
              name: "user_id",
            },
          ],
          foreignKeys: [],
          indexes: [],
          name: "orders",
          rowEstimate: null,
        },
      ],
      views: [
        {
          columns: [
            {
              dataType: "int4",
              defaultValue: null,
              isNullable: false,
              isPrimaryKey: false,
              name: "total",
            },
          ],
          name: "user_stats",
        },
      ],
    },
  ],
};

describe("schemaInfoToSQLNamespace", () => {
  it("converts schema info into a SQL namespace tree", () => {
    const ns = schemaInfoToSQLNamespace(schema) as Record<
      string,
      {
        children: Record<string, { children: unknown[] }>;
      }
    >;
    expect(Object.keys(ns)).toContain("public");
    expect(Object.keys(ns.public.children)).toContain("users");
    expect(Object.keys(ns.public.children)).toContain("user_stats");
  });
});

describe("getDefaultSchema", () => {
  it("prefers a public schema when present", () => {
    expect(getDefaultSchema(schema)).toBe("public");
  });

  it("falls back to main when public is absent", () => {
    expect(
      getDefaultSchema({
        schemas: [
          { name: "main", tables: [], views: [] },
          { name: "other", tables: [], views: [] },
        ],
      })
    ).toBe("main");
  });

  it("returns the only schema when there is exactly one", () => {
    expect(
      getDefaultSchema({ schemas: [{ name: "alpha", tables: [], views: [] }] })
    ).toBe("alpha");
  });

  it("returns undefined when there is no obvious default", () => {
    expect(
      getDefaultSchema({
        schemas: [
          { name: "alpha", tables: [], views: [] },
          { name: "beta", tables: [], views: [] },
        ],
      })
    ).toBeUndefined();
  });
});

const buildState = (doc: string) =>
  EditorState.create({ doc, extensions: [sql()] });

const buildContext = (doc: string, pos = doc.length) => {
  const state = buildState(doc);
  return {
    explicit: true,
    matchBefore: (re: RegExp) => {
      const before = state.doc.sliceString(0, pos);
      const m = before.match(new RegExp(`(${re.source})$`));
      if (!m || m[0] === "") {
        return null;
      }
      return { from: pos - m[0].length, text: m[0], to: pos };
    },
    pos,
    state,
  };
};

interface SyncCompletionResult {
  options: { label: string }[];
  from: number;
}

describe("createTableCompletionSource", () => {
  it("offers tables and views after FROM", () => {
    const source = createTableCompletionSource(schema);
    const result = source(
      buildContext("SELECT * FROM ", "SELECT * FROM ".length) as never
    ) as SyncCompletionResult | null;
    expect(result?.options.map((o) => o.label)).toStrictEqual(
      expect.arrayContaining(["users", "orders", "user_stats"])
    );
  });

  it("returns null when not in a FROM/JOIN clause", () => {
    const source = createTableCompletionSource(schema);
    const result = source(
      buildContext("SELECT id FROM users WHERE ", 26) as never
    );
    expect(result).toBeNull();
  });
});

describe("createColumnCompletionSource", () => {
  it("offers columns from referenced tables", () => {
    const source = createColumnCompletionSource(schema);
    const sqlText = "SELECT  FROM users";
    // Cursor placed after the SELECT token (column position)
    const result = source(
      buildContext(sqlText, "SELECT ".length) as never
    ) as SyncCompletionResult;
    expect(result).not.toBeNull();
    const labels = result.options.map((o) => o.label);
    expect(labels).toStrictEqual(expect.arrayContaining(["id", "email"]));
  });

  it("returns null inside FROM/JOIN clause", () => {
    const source = createColumnCompletionSource(schema);
    const result = source(
      buildContext("SELECT id FROM ", "SELECT id FROM ".length) as never
    );
    expect(result).toBeNull();
  });
});
