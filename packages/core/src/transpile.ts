import { format, transpile } from "@polyglot-sql/sdk";

import type { DialectType } from "./types.ts";

import { DbError } from "./error.ts";
import { toPolyglotDialect as toDialect } from "./polyglot-dialect.ts";

export function transpileSql(
  sql: string,
  sourceDialect: string,
  target: DialectType
): string {
  const source = toDialect(sourceDialect);
  const dest = toDialect(target);
  if (source === dest) {
    return sql;
  }
  const result = transpile(sql, source, dest);
  if (!result.success || !result.sql) {
    throw new DbError(
      "TRANSPILE_ERROR",
      `SQL transpilation failed: ${result.error ?? "unknown error"}`
    );
  }
  return result.sql.join(";\n");
}

export function formatSql(sql: string, dialect: string): string {
  const target = toDialect(dialect);
  const result = format(sql, target);
  if (!result.success || !result.sql) {
    throw new DbError(
      "FORMAT_ERROR",
      `SQL formatting failed: ${result.error ?? "unknown error"}`
    );
  }
  return result.sql.join(";\n\n");
}
