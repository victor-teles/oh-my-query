import fs from "node:fs/promises";

import { atomicWrite, ensureParentDir } from "./fs-utils.ts";
import { configPath } from "./paths.ts";

export interface AISettings {
  provider: string;
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface ActiveConnectionConfig {
  connectionId: string;
  database: string | null;
}

export interface AppConfig {
  /** Legacy plaintext AI settings; migrated to the encrypted ai.enc on read. */
  ai?: AISettings | null;
  activeConnection?: ActiveConnectionConfig | null;
  launcherHotkey?: string;
  clipboardLookups?: boolean;
}

export async function getConfig(): Promise<AppConfig> {
  const filePath = configPath();
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content) as AppConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const filePath = configPath();
  await ensureParentDir(filePath);
  await atomicWrite(filePath, JSON.stringify(config, null, 2));
}
