import type { DbError } from "./error.ts";
import type { ExplainResult } from "./explain.ts";
import type {
  ConnectionParams,
  DialectType,
  ExecuteResult,
  SchemaInfo,
  TestConnectionResult,
} from "./types.ts";

export interface Driver {
  readonly dbType: string;
  testConnection(params: ConnectionParams): Promise<TestConnectionResult>;
  connect(connectionId: string, params: ConnectionParams): Promise<Pool>;
}

export interface Pool {
  readonly dialect: DialectType | null;
  readonly supportsExplain: boolean;
  fetchVersion(): Promise<string>;
  listDatabases(): Promise<string[]>;
  fetchSchema(database: string): Promise<SchemaInfo>;
  execute(
    sql: string,
    maxRows: number,
    schema: string | null,
    signal: AbortSignal
  ): Promise<ExecuteResult>;
  explain(
    sql: string,
    analyze: boolean,
    schema: string | null,
    signal: AbortSignal
  ): Promise<ExplainResult>;
  close(): Promise<void>;
}

export type { DbError };
