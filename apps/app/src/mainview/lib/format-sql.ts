import { formatSql as ipcFormatSql } from "@/lib/ipc";

export const formatSql = (sql: string, dialect: string): Promise<string> =>
  ipcFormatSql(sql, dialect);
