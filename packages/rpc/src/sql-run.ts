import type { DialectType, SchemaInfo } from "@oh-my-query/core/client";

import { z } from "zod";

import { LookupValueSchema } from "./lookup.ts";

export const MAX_RAW_SQL = 20_000;

export const SqlRunSource = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("sql"),
    sql: z.string().trim().min(1).max(MAX_RAW_SQL),
    title: z.string().trim().min(1).max(80).optional(),
  }),
  z.object({
    column: z.string().min(1).max(500),
    kind: z.literal("match"),
    schema: z.string().min(1).max(500),
    table: z.string().min(1).max(500),
    value: LookupValueSchema,
  }),
]);
export type SqlRunSource = z.infer<typeof SqlRunSource>;

export const RunSqlParams = z.object({
  askId: z.string().min(1).max(100),
  connectionId: z.string().min(1).max(200),
  database: z.string().max(500).nullable(),
  source: SqlRunSource,
});
export type RunSqlParams = z.infer<typeof RunSqlParams>;

export interface SchemaPeek {
  database: string;
  dialect: DialectType;
  schema: SchemaInfo;
}
