import fs from "node:fs/promises";
import path from "node:path";

import { configPath } from "./paths.ts";

export interface AISettings {
  provider: string;
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface AppConfig {
  ai?: AISettings | null;
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
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(config, null, 2));
}
