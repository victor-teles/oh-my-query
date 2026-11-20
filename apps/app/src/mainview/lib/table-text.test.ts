import { describe, expect, it } from "vitest";

import type { TableLike } from "./table-text";

import {
  exportBaseName,
  FALLBACK_BASE_NAME,
  toCsv,
  toMarkdown,
  toTsv,
} from "./table-text";

const table = (columns: string[], rows: unknown[][]): TableLike => ({
  columns: columns.map((name) => ({ name, typeName: "text" })),
  rows,
});

describe("toCsv", () => {
  it("writes a header row and LF lines for the clipboard", () => {
    expect(toCsv(table(["id", "name"], [[1, "Alice"]]), "clipboard")).toBe(
      "id,name\n1,Alice"
    );
  });

  it("adds a BOM and CRLF lines for files", () => {
    expect(toCsv(table(["a"], [[1], [2]]), "file")).toBe("﻿a\r\n1\r\n2");
  });

  it.each([
    ["a comma", "a,b", '"a,b"'],
    ["a quote", 'he said "hi"', '"he said ""hi"""'],
    ["a line feed", "line1\nline2", '"line1\nline2"'],
    ["a carriage return", "line1\rline2", '"line1\rline2"'],
    ["a tab", "a\tb", "a\tb"],
    ["a pipe", "a|b", "a|b"],
    ["unicode and emoji", "São Paulo 🌎", "São Paulo 🌎"],
  ])("quotes only when a cell has %s", (_label, value, expected) => {
    expect(toCsv(table(["text"], [[value]]), "clipboard")).toBe(
      `text\n${expected}`
    );
  });

  it("writes nulls as empty cells and objects as JSON", () => {
    expect(
      toCsv(
        table(["a", "b", "c", "d"], [[null, undefined, { k: 1 }, true]]),
        "clipboard"
      )
    ).toBe('a,b,c,d\n,,"{""k"":1}",true');
  });

  it("writes only the header for an empty result", () => {
    expect(toCsv(table(["a", "b"], []), "clipboard")).toBe("a,b");
  });
});

describe("toTsv", () => {
  it("joins cells with tabs and flattens tabs and line breaks", () => {
    expect(
      toTsv(
        table(
          ["a", "b"],
          [
            ["x\ty", "one\r\ntwo"],
            [null, 3],
          ]
        )
      )
    ).toBe("a\tb\nx y\tone two\n\t3");
  });
});

describe("toMarkdown", () => {
  it("right-aligns columns whose values are all numbers", () => {
    expect(
      toMarkdown(
        table(
          ["region", "mrr"],
          [
            ["EMEA", 1200],
            ["APAC", null],
          ]
        )
      )
    ).toBe(
      [
        "| region | mrr |",
        "| --- | ---: |",
        "| EMEA | 1200 |",
        "| APAC |  |",
      ].join("\n")
    );
  });

  it("escapes pipes and turns line breaks into <br>", () => {
    expect(toMarkdown(table(["note"], [["a|b\nc"]]))).toBe(
      "| note |\n| --- |\n| a\\|b<br>c |"
    );
  });

  it("keeps text columns left-aligned when the result is empty", () => {
    expect(toMarkdown(table(["a"], []))).toBe("| a |\n| --- |");
  });

  it("right-aligns numeric columns whose driver returns strings", () => {
    const counts: TableLike = {
      columns: [
        { name: "status", typeName: "TEXT" },
        { name: "order_count", typeName: "INT8" },
      ],
      rows: [["paid", "2"]],
    };
    expect(toMarkdown(counts)).toBe(
      "| status | order_count |\n| --- | ---: |\n| paid | 2 |"
    );
  });

  it("keeps text columns of digits left-aligned", () => {
    expect(toMarkdown(table(["zip"], [["02134"]]))).toBe(
      "| zip |\n| --- |\n| 02134 |"
    );
  });
});

describe("exportBaseName", () => {
  it("slugs a title", () => {
    expect(exportBaseName("Revenue by Region (Q3)")).toBe(
      "revenue-by-region-q3"
    );
  });

  it("caps the name at 60 characters without a trailing dash", () => {
    const name = exportBaseName(`${"a".repeat(59)} b`);
    expect(name).toBe("a".repeat(59));
  });

  it("falls back when nothing is left", () => {
    expect(exportBaseName("📈 — ")).toBe(FALLBACK_BASE_NAME);
  });
});
