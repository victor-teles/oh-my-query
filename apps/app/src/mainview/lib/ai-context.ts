import type { ActiveQuerySnapshot } from "@/contexts/active-query-context";
import type { ExecuteResult } from "@/lib/tauri";

import { classifyError } from "@/lib/query-error";

const MAX_QUERY_CHARS = 2000;
const MAX_SELECTION_CHARS = 1000;
const MAX_PREVIEW_ROWS = 5;
const MAX_CELL_CHARS = 80;
const MAX_DOCUMENT_PREVIEW_CHARS = 600;

const truncate = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max)}… [truncated]`;

const formatCell = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "string") {
    return truncate(value, MAX_CELL_CHARS);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return truncate(JSON.stringify(value), MAX_CELL_CHARS);
  } catch {
    return "[unserializable]";
  }
};

const formatTabularPreview = (
  result: Extract<ExecuteResult, { resultType: "tabular" }>
): string => {
  const totalRows = result.rowCount;
  const previewCount = Math.min(totalRows, MAX_PREVIEW_ROWS);
  const columnSummary = result.columns
    .map((c) => `${c.name} (${c.typeName})`)
    .join(", ");

  const lines: string[] = [
    `Last result: ${totalRows} row${totalRows === 1 ? "" : "s"} in ${result.executionTimeMs}ms${result.isTruncated ? " (truncated by engine)" : ""}`,
    `Columns: ${columnSummary}`,
  ];

  if (previewCount === 0) {
    lines.push("(no rows returned)");
    return lines.join("\n");
  }

  const header = `| ${result.columns.map((c) => c.name).join(" | ")} |`;
  const divider = `| ${result.columns.map(() => "---").join(" | ")} |`;
  lines.push(
    `Preview (first ${previewCount} of ${totalRows}):`,
    header,
    divider
  );

  for (let i = 0; i < previewCount; i += 1) {
    const row = result.rows[i];
    if (!row) {
      continue;
    }
    const cells = result.columns.map((_, idx) => formatCell(row[idx]));
    lines.push(`| ${cells.join(" | ")} |`);
  }

  if (totalRows > previewCount) {
    lines.push(`… and ${totalRows - previewCount} more rows not shown`);
  }

  return lines.join("\n");
};

const formatDocumentPreview = (
  result: Extract<ExecuteResult, { resultType: "documents" }>
): string => {
  const total = result.count;
  const previewCount = Math.min(total, MAX_PREVIEW_ROWS);
  const lines: string[] = [
    `Last result: ${total} document${total === 1 ? "" : "s"} in ${result.executionTimeMs}ms${result.isTruncated ? " (truncated by engine)" : ""}`,
  ];

  if (previewCount === 0) {
    lines.push("(no documents returned)");
    return lines.join("\n");
  }

  lines.push(`Preview (first ${previewCount} of ${total}):`);
  for (let i = 0; i < previewCount; i += 1) {
    const doc = result.documents[i];
    try {
      lines.push(truncate(JSON.stringify(doc), MAX_DOCUMENT_PREVIEW_CHARS));
    } catch {
      lines.push("[unserializable document]");
    }
  }

  if (total > previewCount) {
    lines.push(`… and ${total - previewCount} more documents not shown`);
  }

  return lines.join("\n");
};

const formatResult = (result: ExecuteResult): string =>
  result.resultType === "tabular"
    ? formatTabularPreview(result)
    : formatDocumentPreview(result);

const formatError = (error: string, errorCode: string | null): string => {
  const classification = classifyError(error, errorCode);
  const lines: string[] = [
    `Last error (${classification.label}${errorCode ? `, code ${errorCode}` : ""}): ${error.trim()}`,
  ];
  if (classification.summary) {
    lines.push(`Summary: ${classification.summary}`);
  }
  if (classification.hint) {
    lines.push(`Hint: ${classification.hint}`);
  }
  return lines.join("\n");
};

export const hasMeaningfulContext = (snapshot: ActiveQuerySnapshot): boolean =>
  Boolean(
    snapshot.activeSql.trim() ||
    snapshot.selectedSql?.trim() ||
    snapshot.executedSql?.trim() ||
    snapshot.result ||
    snapshot.error ||
    snapshot.runningSql
  );

export const formatActiveQueryContext = (
  snapshot: ActiveQuerySnapshot
): string | null => {
  if (!hasMeaningfulContext(snapshot)) {
    return null;
  }

  const sections: string[] = ["## Current workspace context"];

  if (snapshot.tabTitle) {
    sections.push(`Active tab: ${snapshot.tabTitle}`);
  }

  sections.push(`Status: ${snapshot.status}`);

  if (snapshot.activeSql.trim()) {
    sections.push(
      `Active query (what the user is editing right now):\n\`\`\`sql\n${truncate(snapshot.activeSql.trim(), MAX_QUERY_CHARS)}\n\`\`\``
    );
  }

  if (snapshot.selectedSql?.trim()) {
    sections.push(
      `Selected text (user highlighted this portion):\n\`\`\`sql\n${truncate(snapshot.selectedSql.trim(), MAX_SELECTION_CHARS)}\n\`\`\``
    );
  }

  if (
    snapshot.status === "running" &&
    snapshot.runningSql?.trim() &&
    snapshot.runningSql.trim() !== snapshot.activeSql.trim()
  ) {
    sections.push(
      `Running query (currently executing):\n\`\`\`sql\n${truncate(snapshot.runningSql.trim(), MAX_QUERY_CHARS)}\n\`\`\``
    );
  }

  if (
    snapshot.executedSql?.trim() &&
    snapshot.executedSql.trim() !== snapshot.activeSql.trim()
  ) {
    sections.push(
      `Last executed query:\n\`\`\`sql\n${truncate(snapshot.executedSql.trim(), MAX_QUERY_CHARS)}\n\`\`\``
    );
  }

  if (snapshot.result) {
    sections.push(formatResult(snapshot.result));
  }

  if (snapshot.error) {
    sections.push(formatError(snapshot.error, snapshot.errorCode));
  }

  sections.push(
    "Use this context to ground your answer in what the user is actually working on. Reference specific tables, columns, values, or errors when relevant. Do not invent data you don't see here."
  );

  return sections.join("\n\n");
};
