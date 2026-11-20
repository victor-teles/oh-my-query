import { tokenizeSqlTemplate } from "@conch/core/client";

const LINE_BREAKS = /\r\n|\r|\n/g;
const LINE_COMMENT = /^--\s?/;

export const hasLineBreak = (text: string): boolean => /[\r\n]/.test(text);

const blockComment = (lineComment: string): string => {
  const body = lineComment
    .replace(LINE_COMMENT, "")
    .replaceAll("*/", "* /")
    .trimEnd();
  return `/* ${body} */`;
};

const segmentText = (kind: string, text: string): string =>
  kind === "comment" && text.startsWith("--") ? blockComment(text) : text;

// A text input drops line breaks, which would glue `select a\nfrom t` into
// `select afrom t` and let a `--` comment swallow the rest of the query.
export const flattenPastedSql = (text: string): string => {
  let joined: string;
  try {
    joined = tokenizeSqlTemplate(text, "postgresql")
      .map((segment) => segmentText(segment.kind, segment.text))
      .join("");
  } catch {
    joined = text;
  }
  return joined.replaceAll(LINE_BREAKS, " ").replaceAll(/ {2,}/g, " ").trim();
};
