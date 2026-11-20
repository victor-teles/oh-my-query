import { describe, expect, it } from "vitest";

import { highlightJsonLines, tokenizeJson } from "@/lib/json-highlight";

const kinds = (text: string) =>
  tokenizeJson(text).map((token) => [token.kind, token.text]);

describe("tokenizeJson", () => {
  it("marks $operator keys as keywords and field paths as references", () => {
    expect(kinds('{"$group": {"_id": "$status"}}')).toStrictEqual([
      ["punctuation", "{"],
      ["punctuation", '"'],
      ["keyword", "$group"],
      ["punctuation", '"'],
      ["punctuation", ":"],
      ["plain", " "],
      ["punctuation", "{"],
      ["punctuation", '"'],
      ["identifier", "_id"],
      ["punctuation", '"'],
      ["punctuation", ":"],
      ["plain", " "],
      ["punctuation", '"'],
      ["function", "$status"],
      ["punctuation", '"'],
      ["punctuation", "}"],
      ["punctuation", "}"],
    ]);
  });

  it("marks upper-case command names as keywords and keeps other strings", () => {
    expect(kinds('["ZREVRANGE", "leaderboard", "0", 9]')).toStrictEqual([
      ["punctuation", "["],
      ["punctuation", '"'],
      ["keyword", "ZREVRANGE"],
      ["punctuation", '"'],
      ["punctuation", ","],
      ["plain", " "],
      ["punctuation", '"'],
      ["string", "leaderboard"],
      ["punctuation", '"'],
      ["punctuation", ","],
      ["plain", " "],
      ["punctuation", '"'],
      ["string", "0"],
      ["punctuation", '"'],
      ["punctuation", ","],
      ["plain", " "],
      ["number", "9"],
      ["punctuation", "]"],
    ]);
  });

  it("colours numbers and literals", () => {
    expect(kinds("[-1.5e3, true, false, null]")).toStrictEqual([
      ["punctuation", "["],
      ["number", "-1.5e3"],
      ["punctuation", ","],
      ["plain", " "],
      ["number", "true"],
      ["punctuation", ","],
      ["plain", " "],
      ["number", "false"],
      ["punctuation", ","],
      ["plain", " "],
      ["number", "null"],
      ["punctuation", "]"],
    ]);
  });

  it("keeps escaped quotes inside a string", () => {
    expect(kinds(String.raw`"say \"hi\""`)).toStrictEqual([
      ["punctuation", '"'],
      ["string", String.raw`say \"hi\"`],
      ["punctuation", '"'],
    ]);
  });

  it("tolerates a string that is still streaming", () => {
    expect(kinds('{"pipe')).toStrictEqual([
      ["punctuation", "{"],
      ["punctuation", '"'],
      ["string", "pipe"],
    ]);
    expect(kinds('"')).toStrictEqual([["punctuation", '"']]);
  });

  it("passes unknown characters through as plain text", () => {
    expect(kinds("db.orders")).toStrictEqual([["plain", "db.orders"]]);
  });
});

describe("highlightJsonLines", () => {
  it("splits tokens across lines", () => {
    const lines = highlightJsonLines('{\n  "kind": "scan"\n}');
    expect(lines).toHaveLength(3);
    expect(lines[1]?.map((token) => token.text).join("")).toBe(
      '  "kind": "scan"'
    );
  });
});
