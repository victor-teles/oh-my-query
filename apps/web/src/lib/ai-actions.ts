import { classifyError } from "@/lib/query-error";

export type AIActionType = "generate" | "explain" | "fix";

export interface AIAction {
  type: AIActionType;
  sql?: string;
  error?: string;
  errorCode?: string | null;
  isSelection?: boolean;
}

export const composeActionMessage = (action: AIAction): string | null => {
  switch (action.type) {
    case "explain": {
      if (!action.sql?.trim()) {
        return null;
      }
      const scope = action.isSelection
        ? "the highlighted selection"
        : "this SQL query";
      return `Explain ${scope}, step by step. Call out any tables, joins, or filters that might be non-obvious.\n\n\`\`\`sql\n${action.sql.trim()}\n\`\`\``;
    }
    case "fix": {
      if (!action.sql?.trim() && !action.error?.trim()) {
        return null;
      }
      const parts: string[] = [];
      if (action.error?.trim()) {
        const classification = classifyError(
          action.error,
          action.errorCode ?? null
        );
        parts.push(
          `The last query failed with a ${classification.label.toLowerCase()} error. Diagnose the cause and propose a corrected query.`
        );
        parts.push(`Error: ${action.error.trim()}`);
        if (classification.hint) {
          parts.push(`Likely cause: ${classification.hint}`);
        }
      } else {
        parts.push(
          "Review this SQL query, find issues, and propose a corrected version."
        );
      }
      if (action.sql?.trim()) {
        parts.push(`\`\`\`sql\n${action.sql.trim()}\n\`\`\``);
      }
      return parts.join("\n\n");
    }
    case "generate": {
      return null;
    }
    default: {
      return null;
    }
  }
};
