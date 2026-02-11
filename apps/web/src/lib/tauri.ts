import type { DatabaseConnection } from "@/lib/connections";

interface TestConnectionResult {
  success: boolean;
  message: string;
  latencyMs: number;
}

const isTauri = (): boolean => "__TAURI_INTERNALS__" in window;

export const testConnection = async (
  connection: Omit<DatabaseConnection, "id" | "name" | "createdAt">
): Promise<TestConnectionResult> => {
  if (!isTauri()) {
    return {
      latencyMs: 0,
      message: "Simulated connection (browser mode)",
      success: true,
    };
  }

  const { invoke } = await import("@tauri-apps/api/core");

  const result = await invoke<TestConnectionResult>("test_connection", {
    params: {
      database: connection.database,
      host: connection.host,
      password: connection.password,
      port: connection.port,
      type: connection.type,
      username: connection.username,
    },
  });

  return result;
};
