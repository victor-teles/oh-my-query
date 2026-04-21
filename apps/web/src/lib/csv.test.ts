import { describe, expect, it } from "vitest";

import type { TabularResult } from "@/lib/tauri";

import { tabularResultToCsv } from "@/lib/csv";

const makeResult = (columns: string[], rows: unknown[][]): TabularResult => ({
  columns: columns.map((name) => ({ name, typeName: "text" })),
  executionTimeMs: 0,
  isTruncated: false,
  resultType: "tabular",
  rowCount: rows.length,
  rows,
});

describe("csv export", () => {
  it("emits headers by default", () => {
    const csv = tabularResultToCsv(makeResult(["id", "name"], [[1, "Alice"]]));
    expect(csv).toBe("id,name\n1,Alice");
  });

  it("omits headers when asked", () => {
    const csv = tabularResultToCsv(makeResult(["id"], [[1], [2]]), {
      includeHeaders: false,
    });
    expect(csv).toBe("1\n2");
  });

  it("quotes cells containing the delimiter", () => {
    const csv = tabularResultToCsv(makeResult(["text"], [["a,b"]]), {
      includeHeaders: false,
    });
    expect(csv).toBe('"a,b"');
  });

  it("quotes cells containing double quotes and escapes them", () => {
    const csv = tabularResultToCsv(makeResult(["text"], [['he said "hi"']]), {
      includeHeaders: false,
    });
    expect(csv).toBe('"he said ""hi"""');
  });

  it("quotes cells containing newlines", () => {
    const csv = tabularResultToCsv(makeResult(["text"], [["line1\nline2"]]), {
      includeHeaders: false,
    });
    expect(csv).toBe('"line1\nline2"');
  });

  it("renders null and undefined as the nullDisplay", () => {
    const csv = tabularResultToCsv(
      makeResult(["a", "b"], [[null, undefined]]),
      { includeHeaders: false, nullDisplay: "NULL" }
    );
    expect(csv).toBe("NULL,NULL");
  });

  it("supports alternate delimiters", () => {
    const csv = tabularResultToCsv(makeResult(["a", "b"], [[1, 2]]), {
      delimiter: "\t",
      includeHeaders: false,
    });
    expect(csv).toBe("1\t2");
  });

  it("prepends a UTF-8 BOM when requested", () => {
    const csv = tabularResultToCsv(makeResult(["a"], [[1]]), {
      includeBom: true,
      includeHeaders: false,
    });
    expect(csv.startsWith("\uFEFF")).toBeTruthy();
  });
});
