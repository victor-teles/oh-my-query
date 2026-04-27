import { DbError } from "./error.ts";

const SCHEMA_NAME_RE = /^[A-Za-z0-9_.-]+$/;

export function validateSchemaName(name: string): void {
  if (!name || !SCHEMA_NAME_RE.test(name)) {
    throw new DbError("INVALID_SCHEMA", `Invalid schema name: ${name}`);
  }
}

const DESTRUCTIVE_HEAD_OK = new Set([
  "SELECT",
  "WITH",
  "VALUES",
  "TABLE",
  "SHOW",
]);

export function guardDestructive(sql: string): void {
  const head = (sql.split(/\s+/)[0] ?? "").toUpperCase();
  if (!DESTRUCTIVE_HEAD_OK.has(head)) {
    throw new DbError(
      "EXPLAIN_DESTRUCTIVE",
      `Refusing to EXPLAIN ANALYZE on a ${head} statement — it would execute. Turn off ANALYZE to see the estimated plan.`
    );
  }
}
