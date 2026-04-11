import { describe, expect, it } from "vitest";

import {
  rowsToCsv,
  rowsToInserts,
  rowsToMarkdown,
  rowsToTsv,
} from "@/lib/row-serializers";

const slice = {
  columns: [
    { name: "id", typeName: "int" },
    { name: "payload", typeName: "json" },
    { name: "notes", typeName: "text" },
    { name: "enabled", typeName: "bool" },
  ],
  rows: [[1, { city: "Rio", tags: ["blue", "night"] }, "line 1\nline 2", true]],
};

describe("row serializers", () => {
  it("serializes objects consistently in CSV and TSV output", () => {
    expect(
      rowsToCsv(slice, {
        delimiter: ",",
        includeBom: false,
        includeHeaders: true,
        nullDisplay: "",
      })
    ).toContain('"{""city"":""Rio"",""tags"":[""blue"",""night""]}"');

    expect(rowsToTsv(slice)).toContain(
      '"{""city"":""Rio"",""tags"":[""blue"",""night""]}"'
    );
  });

  it("serializes multiline text and booleans in Markdown output", () => {
    expect(rowsToMarkdown(slice)).toContain("line 1<br/>line 2");
    expect(rowsToMarkdown(slice)).toContain("true");
  });

  it("serializes structured values as quoted SQL literals in INSERT output", () => {
    expect(rowsToInserts(slice, "events")).toContain(
      "INSERT INTO events (id, payload, notes, enabled) VALUES (1, '{\"city\":\"Rio\",\"tags\":[\"blue\",\"night\"]}', 'line 1\nline 2', TRUE);"
    );
  });
});
