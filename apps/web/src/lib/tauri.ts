import type { DatabaseConnection } from "@/lib/connections";

interface TestConnectionResult {
  success: boolean;
  message: string;
  latencyMs: number;
}

export const isTauri = (): boolean => "__TAURI_INTERNALS__" in window;

const getWindow = async () => {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
};

export const minimizeWindow = async (): Promise<void> => {
  if (!isTauri()) {
    return;
  }
  const win = await getWindow();
  await win.minimize();
};

export const toggleMaximizeWindow = async (): Promise<void> => {
  if (!isTauri()) {
    return;
  }
  const win = await getWindow();
  await win.toggleMaximize();
};

export const closeWindow = async (): Promise<void> => {
  if (!isTauri()) {
    return;
  }
  const win = await getWindow();
  await win.close();
};

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
