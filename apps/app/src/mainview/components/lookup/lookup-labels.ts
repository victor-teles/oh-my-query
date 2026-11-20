import type { LookupErrorCode, LookupHit, LookupValue } from "@/lib/ipc";

import type { LookupState } from "./lookup-reducer";

const counts = new Intl.NumberFormat("en-US");
const tableList = new Intl.ListFormat("en-US", {
  style: "long",
  type: "conjunction",
});

const plural = (count: number, word: string): string =>
  `${counts.format(count)} ${word}${count === 1 ? "" : "s"}`;

const UUID_HEAD = 6;
const UUID_TAIL = 4;
const MAX_SHOWN = 28;

const truncateMiddle = (text: string, max: number): string => {
  if (text.length <= max) {
    return text;
  }
  const head = Math.ceil((max - 1) / 2);
  const tail = Math.floor((max - 1) / 2);
  return `${text.slice(0, head)}…${text.slice(-tail)}`;
};

export const shortValue = (value: LookupValue): string =>
  value.kind === "uuid"
    ? `${value.value.slice(0, UUID_HEAD)}…${value.value.slice(-UUID_TAIL)}`
    : truncateMiddle(value.value, MAX_SHOWN);

export const KIND_TAGS: Record<LookupValue["kind"], string> = {
  email: "Email",
  integer: "ID",
  uuid: "UUID",
};

export const countLabel = (hit: LookupHit): string =>
  hit.capped ? "100+" : counts.format(hit.matchedRows);

export const rowsLabel = (hit: LookupHit): string =>
  hit.capped ? "100 or more rows" : plural(hit.matchedRows, "row");

const ERROR_LINES: Record<LookupErrorCode, string> = {
  CANCELLED: "Stopped",
  CONNECTION_MISSING: "Connection not found",
  FAILED: "The search failed",
  NO_CANDIDATES: "Nothing to search",
  UNSUPPORTED_ENGINE: "Can't search this connection",
};

const elapsed = (state: LookupState): string =>
  `${counts.format(state.elapsedMs ?? 0)}ms`;

export const statusLine = (state: LookupState): string => {
  switch (state.status) {
    case "probing": {
      return `Searching ${plural(state.tables, "table")}…`;
    }
    case "done": {
      return state.hits.length > 0
        ? `Found in ${plural(state.hits.length, "table")} · ${elapsed(state)}`
        : `No matches · ${elapsed(state)}`;
    }
    case "cancelled": {
      return state.total > 0
        ? `Stopped · ${state.done} of ${plural(state.total, "column")}`
        : "Stopped";
    }
    case "error": {
      return ERROR_LINES[state.error?.code ?? "FAILED"];
    }
    default: {
      return "Reading the schema…";
    }
  }
};

export const statusNotes = (state: LookupState): string[] => {
  if (state.status !== "done") {
    return [];
  }
  const notes: string[] = [];
  if (state.failed > 0) {
    notes.push(`${plural(state.failed, "column")} didn't answer in time.`);
  }
  if (state.budgetExceeded) {
    notes.push("Stopped at the 15-second limit.");
  }
  return notes;
};

const tablesOf = (hits: readonly LookupHit[]): string =>
  tableList.format([...new Set(hits.map((hit) => hit.table))]);

export const announcement = (state: LookupState): string => {
  switch (state.status) {
    case "done": {
      return state.hits.length > 0
        ? `Found in ${tablesOf(state.hits)}`
        : `No matches in ${plural(state.tables, "table")}`;
    }
    case "probing": {
      return state.firstHit ? `Found in ${state.firstHit.table}` : "";
    }
    case "cancelled": {
      return "Search stopped";
    }
    case "error": {
      return state.error?.message ?? "";
    }
    default: {
      return "";
    }
  }
};

export interface EmptyCopy {
  title: string;
  notes: string[];
}

export const emptyCopy = (state: LookupState): EmptyCopy => {
  const value = state.value ? shortValue(state.value) : "this value";
  const notes = [
    state.value?.kind === "email"
      ? "Exact match. Emails are compared as typed."
      : "Exact match only.",
  ];
  const { largeUnindexed, overLimit, outOfRange } = state.skipped;
  if (largeUnindexed > 0) {
    notes.push(
      `Skipped ${plural(largeUnindexed, "large table")} without an index on the column.`
    );
  }
  if (outOfRange > 0) {
    notes.push(
      `Skipped ${plural(outOfRange, "column")} too small for this number.`
    );
  }
  if (overLimit > 0) {
    const verb = overLimit === 1 ? "wasn't" : "weren't";
    notes.push(`${plural(overLimit, "more column")} ${verb} searched.`);
  }
  return {
    notes,
    title: `No rows match ${value} in ${plural(state.tables, "table")}.`,
  };
};
