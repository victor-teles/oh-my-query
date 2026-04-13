export type AIActionType = "generate" | "explain" | "fix";

export interface AIAction {
  type: AIActionType;
  sql?: string;
  error?: string;
}

export const composeActionMessage = (action: AIAction): string | null => {
  switch (action.type) {
    case "explain": {
      if (!action.sql?.trim()) {
        return null;
      }
      return `Explain this SQL query:\n\`\`\`sql\n${action.sql.trim()}\n\`\`\``;
    }
    case "fix": {
      if (!action.sql?.trim() && !action.error?.trim()) {
        return null;
      }
      const parts = ["Fix this SQL query."];
      if (action.error?.trim()) {
        parts.push(`Error: ${action.error.trim()}`);
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
