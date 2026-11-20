import fs from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import { appDir, configPath } from "./paths.ts";

const LEGACY_APP_DIR = ".config/oh-my-query";
const LEGACY_CONFIG_FILE = "oh-my-query.json";

const exists = async (target: string): Promise<boolean> => {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
};

export async function migrateLegacyAppDir(): Promise<boolean> {
  const legacyDir = path.join(homedir(), LEGACY_APP_DIR);
  const currentDir = appDir();
  if ((await exists(currentDir)) || !(await exists(legacyDir))) {
    return false;
  }
  await fs.mkdir(path.dirname(currentDir), { recursive: true });
  await fs.rename(legacyDir, currentDir);
  const legacyConfig = path.join(currentDir, LEGACY_CONFIG_FILE);
  if (await exists(legacyConfig)) {
    await fs.rename(legacyConfig, configPath());
  }
  return true;
}
