import { isTauri } from "@/lib/tauri";

export const formatSql = async (
  sql: string,
  dialect: string
): Promise<string> => {
  if (!isTauri()) {
    return sql;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("format_sql", { dialect, sql });
};
