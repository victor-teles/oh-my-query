import type { QueryLanguage } from "@conch/core/client";

import type { DatabaseType } from "@/lib/connections";

export type QueryKind = "sql" | "mongodb" | "redis";

export const queryKindOf = (
  language: QueryLanguage | null,
  connectionType: DatabaseType | undefined
): QueryKind => {
  const known = language ?? connectionType;
  return known === "mongodb" || known === "redis" ? known : "sql";
};

export const GENERATED_HEADINGS: Record<QueryKind, string> = {
  mongodb: "Generated pipeline",
  redis: "Generated commands",
  sql: "Generated SQL",
};

export const WRITING_LABELS: Record<QueryKind, string> = {
  mongodb: "Writing the pipeline",
  redis: "Writing the commands",
  sql: "Writing SQL",
};
