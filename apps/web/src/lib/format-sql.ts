import { format } from "sql-formatter";

type SqlDatabaseType = "postgresql" | "mysql" | "sqlite";

const LANGUAGE_MAP: Record<SqlDatabaseType, "postgresql" | "mysql" | "sqlite"> =
  {
    mysql: "mysql",
    postgresql: "postgresql",
    sqlite: "sqlite",
  };

export const formatSql = (sql: string, databaseType: SqlDatabaseType): string =>
  format(sql, {
    keywordCase: "upper",
    language: LANGUAGE_MAP[databaseType],
    tabWidth: 2,
  });
