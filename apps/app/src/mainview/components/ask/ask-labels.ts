import type { AskIndicatorState } from "./ask-indicator";
import type { AskSource, AskState } from "./ask-reducer";
import type { StatusLabel } from "./ask-status";

import { isRefining, isWorking, lineCount, shownTurn } from "./ask-reducer";

const counts = new Intl.NumberFormat("en-US");

const plural = (count: number, word: string): string =>
  `${counts.format(count)} ${word}${count === 1 ? "" : "s"}`;

const refiningSegments = (state: AskState): string[] => {
  if (state.status === "run") {
    return ["Running", "read only"];
  }
  const rows = state.answer?.result.rowCount;
  if (state.status === "present" && rows !== undefined) {
    return ["Shaping", plural(rows, "row")];
  }
  return ["Writing SQL", plural(lineCount(state.sql), "line")];
};

export const headerSegments = (
  state: AskState,
  engine: string,
  connectionName: string
): string[] => {
  if (isRefining(state)) {
    return [engine, ...refiningSegments(state)];
  }
  const result = state.answer?.result;
  if (result) {
    return [
      engine,
      plural(result.rowCount, "row"),
      `${counts.format(result.executionTimeMs)}ms`,
    ];
  }
  if (state.sqlComplete) {
    return [engine, plural(lineCount(state.sql), "line")];
  }
  return [engine, connectionName];
};

export const indicatorFor = (state: AskState): AskIndicatorState => {
  if (isWorking(state.status)) {
    return "busy";
  }
  if (state.status === "error") {
    return "error";
  }
  return state.status === "done" ? "success" : "idle";
};

export const statusLabel = (
  state: AskState,
  connectionName: string
): StatusLabel => {
  if (state.status === "cancelled") {
    return { primary: "Stopped", secondary: null };
  }
  switch (state.phase) {
    case "run": {
      return {
        primary: "Running query",
        secondary: `Read only on ${connectionName}`,
      };
    }
    case "present": {
      const rows = state.answer?.result.rowCount;
      return {
        primary: "Shaping the result",
        secondary: rows === undefined ? null : plural(rows, "row"),
      };
    }
    default: {
      if (state.repairs > 0) {
        return {
          primary: `Fixing the query · attempt ${state.repairs + 1}`,
          secondary: state.repairReason,
        };
      }
      return {
        primary: "Writing SQL",
        secondary: state.schemaDetail ?? `Reading the ${connectionName} schema`,
      };
    }
  }
};

const SQL_HEADINGS: Record<AskSource, string> = {
  match: "Matching rows",
  question: "Generated SQL",
  sql: "Your SQL",
};

export const sqlHeading = (source: AskSource): string => SQL_HEADINGS[source];

export const askActionLabel = (source: AskSource, repeat: boolean): string => {
  if (source === "match") {
    return "Ask";
  }
  if (source === "sql") {
    return repeat ? "Run again" : "Run";
  }
  return repeat ? "Ask again" : "Ask";
};

// Spoken once per settled change, never per frame.
export const askAnnouncement = (state: AskState): string => {
  const turn = shownTurn(state);
  if (!turn || isWorking(state.status) || state.status === "error") {
    return "";
  }
  if (state.transition === "refine") {
    return `Updated: ${turn.answer.spec.title}`;
  }
  if (state.transition === "step") {
    return `Step ${state.position + 1} of ${state.turns.length}: ${turn.prompt}`;
  }
  return "";
};
