import type { ConnectionPoolManager } from "@conch/drivers";
import type { SchemaPeek } from "@conch/rpc";

import { DbError } from "@conch/core";
import { z } from "zod";

import type { SchemaCache } from "./schema-cache.ts";

import {
  ensurePool,
  findConnection,
  resolveSchemaName,
} from "./connection-access.ts";

const PeekParams = z.object({ connectionId: z.string().min(1).max(200) });

export interface SchemaPeekDeps {
  pools: ConnectionPoolManager;
  schemas: SchemaCache;
}

export const createSchemaPeek = ({ pools, schemas }: SchemaPeekDeps) => ({
  async peek(input: unknown): Promise<SchemaPeek> {
    const { connectionId } = PeekParams.parse(input);
    const connection = await findConnection(connectionId);
    if (!connection) {
      throw new DbError(
        "CONNECTION_MISSING",
        "This connection no longer exists."
      );
    }
    const pool = await ensurePool(pools, connection);
    const { dialect } = pool;
    if (!dialect) {
      throw new DbError(
        "UNSUPPORTED_ENGINE",
        "Table peek works with SQL databases for now."
      );
    }
    const database = await resolveSchemaName(pool, null, connection);
    const schema = await schemas.get(connection.id, database);
    return { database, dialect, schema };
  },
});

export type SchemaPeekService = ReturnType<typeof createSchemaPeek>;
