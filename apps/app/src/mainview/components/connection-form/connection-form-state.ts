import type {
  ConnectionColor,
  ConnectionEnvironment,
  DatabaseConnection,
  DatabaseType,
} from "@/lib/connections";

import { DEFAULT_PORTS } from "@/lib/connections";

export interface FormState {
  name: string;
  type: DatabaseType;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  authSource: string;
  trustServerCertificate: boolean;
  emoji: string;
  color: ConnectionColor | "";
  environment: ConnectionEnvironment | "";
  piiRedaction: boolean | undefined;
  customPiiPatterns: string;
}

export type TestStatus =
  | { state: "idle" }
  | { state: "testing" }
  | { state: "success"; message: string; latencyMs: number }
  | { state: "error"; message: string };

export const INITIAL_STATE: FormState = {
  authSource: "",
  color: "",
  customPiiPatterns: "",
  database: "",
  emoji: "",
  environment: "",
  host: "localhost",
  name: "",
  password: "",
  piiRedaction: undefined,
  port: String(DEFAULT_PORTS.postgresql),
  trustServerCertificate: true,
  type: "postgresql",
  username: "",
};

export const connectionToFormState = (conn: DatabaseConnection): FormState => ({
  authSource: conn.authSource ?? "",
  color: conn.color ?? "",
  customPiiPatterns: conn.customPiiPatterns?.join("\n") ?? "",
  database: conn.database,
  emoji: conn.emoji ?? "",
  environment: conn.environment ?? "",
  host: conn.host,
  name: conn.name,
  password: conn.password,
  piiRedaction: conn.piiRedaction,
  port: String(conn.port),
  trustServerCertificate: conn.trustServerCertificate ?? true,
  type: conn.type,
  username: conn.username,
});
