import {
  parseLauncherInput,
  SQL_PREFIX,
} from "@/components/launcher/input-mode";

import type { AskSource, AskState } from "./ask-reducer";

export interface AskSubmission {
  source: Exclude<AskSource, "match">;
  text: string;
}

export const draftOf = ({
  source,
  prompt,
}: Pick<AskState, "source" | "prompt">): string => {
  if (source === "match") {
    return "";
  }
  return source === "sql" ? `${SQL_PREFIX}${prompt}` : prompt;
};

export const submissionOf = (draft: string): AskSubmission | null => {
  const input = parseLauncherInput(draft);
  if (input.mode === "sql") {
    return input.sql ? { source: "sql", text: input.sql } : null;
  }
  const text = draft.trim();
  return text ? { source: "question", text } : null;
};
