import type {
  ConnectionEnvironment,
  DatabaseConnection,
  DatabaseType,
} from "@/lib/connections";

import { testConnection } from "@/lib/tauri";

import type { FormState, TestStatus } from "./connection-form-state";

import { NEEDS_HOST, NEEDS_USERNAME } from "./constants";

export const effectivePiiEnabled = (
  piiRedaction: boolean | undefined,
  environment: ConnectionEnvironment | ""
): boolean => {
  if (piiRedaction !== undefined) {
    return piiRedaction;
  }
  return environment === "prod";
};

export const parseCustomPiiPatterns = (raw: string): string[] | undefined => {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
  return lines.length > 0 ? lines : undefined;
};

export const getDatabaseLabel = (type: DatabaseType): string => {
  if (type === "sqlite" || type === "duckdb") {
    return "File path";
  }
  if (type === "redis") {
    return "Database index";
  }
  return "Database";
};

export const getDatabaseHint = (type: DatabaseType): string | null => {
  if (type === "redis") {
    return "Redis DBs are numbered 0–15. You can switch DBs inside the workspace after connecting.";
  }
  if (type === "duckdb") {
    return "Use :memory: for an in-process database, or an absolute path to a .duckdb file.";
  }
  return null;
};

export const getUsernamePlaceholder = (type: DatabaseType): string => {
  if (type === "mongodb") {
    return "";
  }
  if (type === "clickhouse") {
    return "default";
  }
  if (type === "mssql") {
    return "sa";
  }
  return "postgres";
};

export const getDatabasePlaceholder = (type: DatabaseType): string => {
  if (type === "sqlite") {
    return "/path/to/database.db";
  }
  if (type === "duckdb") {
    return ":memory: or /path/to/warehouse.duckdb";
  }
  if (type === "redis") {
    return "0";
  }
  return "my_database";
};

export const buildConnection = (form: FormState): DatabaseConnection => {
  const hasHost = NEEDS_HOST.has(form.type);
  const hasUsername = NEEDS_USERNAME.has(form.type);
  const emoji = form.emoji.trim();
  const customPiiPatterns = effectivePiiEnabled(
    form.piiRedaction,
    form.environment
  )
    ? parseCustomPiiPatterns(form.customPiiPatterns)
    : undefined;
  return {
    authSource:
      form.type === "mongodb" && form.authSource.trim()
        ? form.authSource.trim()
        : undefined,
    color: form.color || undefined,
    createdAt: new Date().toISOString(),
    customPiiPatterns,
    database: form.database.trim(),
    emoji: emoji || undefined,
    environment: form.environment || undefined,
    host: hasHost ? form.host.trim() : "",
    id: crypto.randomUUID(),
    lastConnectedAt: null,
    name: form.name.trim(),
    password: hasHost ? form.password : "",
    piiRedaction: form.piiRedaction,
    pinned: false,
    port: hasHost ? Number(form.port) : 0,
    trustServerCertificate:
      form.type === "mssql" ? form.trustServerCertificate : undefined,
    type: form.type,
    username: hasUsername ? form.username.trim() : "",
  };
};

export const buildConnectionParams = (form: FormState) => {
  const hasHost = NEEDS_HOST.has(form.type);
  const hasUsername = NEEDS_USERNAME.has(form.type);
  return {
    authSource:
      form.type === "mongodb" && form.authSource.trim()
        ? form.authSource.trim()
        : undefined,
    database: form.database.trim(),
    host: hasHost ? form.host.trim() : "",
    password: hasHost ? form.password : "",
    port: hasHost ? Number(form.port) : 0,
    trustServerCertificate:
      form.type === "mssql" ? form.trustServerCertificate : undefined,
    type: form.type,
    username: hasUsername ? form.username.trim() : "",
  };
};

export const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "Connection failed";
};

export const attemptTestConnection = async (
  form: FormState
): Promise<TestStatus> => {
  try {
    const result = await testConnection(buildConnectionParams(form));
    if (result.success) {
      return {
        latencyMs: result.latencyMs,
        message: result.message,
        state: "success",
      };
    }
    return { message: result.message, state: "error" };
  } catch (error: unknown) {
    return { message: getErrorMessage(error), state: "error" };
  }
};

export const validate = (form: FormState): string | null => {
  if (!form.name.trim()) {
    return "Connection name is required";
  }
  if (form.type !== "redis" && !form.database.trim()) {
    return "Database name is required";
  }
  if (NEEDS_HOST.has(form.type) && !form.host.trim()) {
    return "Host is required";
  }
  return null;
};
