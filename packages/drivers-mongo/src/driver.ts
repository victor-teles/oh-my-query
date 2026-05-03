import type {
  ConnectionParams,
  Driver,
  Pool,
  TestConnectionResult,
} from "@oh-my-query/core";
import type { MongoClientOptions } from "mongodb";

import { MongoClient } from "mongodb";

import { mapMongoError, MongoPool } from "./pool.ts";

const SERVER_SELECTION_TIMEOUT_MS = 10_000;

export function buildMongoUri(params: ConnectionParams): string {
  const auth = params.username
    ? `${encodeURIComponent(params.username)}${
        params.password ? `:${encodeURIComponent(params.password)}` : ""
      }@`
    : "";
  return `mongodb://${auth}${params.host}:${params.port}/`;
}

export function buildMongoClientOptions(
  params: ConnectionParams,
  appName: string
): MongoClientOptions {
  const options: MongoClientOptions = {
    appName,
    serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
  };
  if (params.authSource) {
    options.authSource = params.authSource;
  }
  if (params.trustServerCertificate) {
    options.tls = true;
    options.tlsAllowInvalidCertificates = true;
  }
  return options;
}

function openClient(params: ConnectionParams, appName: string): MongoClient {
  try {
    return new MongoClient(
      buildMongoUri(params),
      buildMongoClientOptions(params, appName)
    );
  } catch (error) {
    throw mapMongoError(error);
  }
}

async function safeClose(client: MongoClient): Promise<void> {
  try {
    await client.close();
  } catch {
    // already closing
  }
}

export class MongoDriver implements Driver {
  readonly dbType = "mongodb";

  async testConnection(
    params: ConnectionParams
  ): Promise<TestConnectionResult> {
    const start = performance.now();
    const client = openClient(params, this.dbType);
    try {
      await client.connect();
      await client.db(params.database || "admin").command({ ping: 1 });
      return {
        latencyMs: Math.round(performance.now() - start),
        message: `${this.dbType} connection successful`,
        success: true,
      };
    } catch (error) {
      throw mapMongoError(error);
    } finally {
      await safeClose(client);
    }
  }

  async connect(_id: string, params: ConnectionParams): Promise<Pool> {
    const client = openClient(params, this.dbType);
    try {
      await client.connect();
      await client.db(params.database || "admin").command({ ping: 1 });
    } catch (error) {
      await safeClose(client);
      throw mapMongoError(error);
    }
    return new MongoPool(client, params.database || "admin");
  }
}
