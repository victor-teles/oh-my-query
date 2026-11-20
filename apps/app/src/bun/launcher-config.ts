import type { ActiveConnection } from "@conch/rpc";

import { getConfig, saveConfig } from "@conch/core";
import { DEFAULT_CLIPBOARD_LOOKUPS, DEFAULT_LAUNCHER_HOTKEY } from "@conch/rpc";
import { z } from "zod";

export const readLauncherHotkey = async (): Promise<string> => {
  try {
    const config = await getConfig();
    return config.launcherHotkey ?? DEFAULT_LAUNCHER_HOTKEY;
  } catch (error) {
    console.error(
      "[launcher] could not read config; using the default hotkey",
      error
    );
    return DEFAULT_LAUNCHER_HOTKEY;
  }
};

const activeConnectionSchema = z
  .object({
    connectionId: z.string().min(1).max(200),
    database: z.string().max(500).nullable(),
  })
  .nullable();

export const readActiveConnection =
  async (): Promise<ActiveConnection | null> => {
    const config = await getConfig();
    return config.activeConnection ?? null;
  };

export const writeActiveConnection = async (
  active: ActiveConnection | null
): Promise<void> => {
  const next = activeConnectionSchema.parse(active);
  const config = await getConfig();
  await saveConfig({ ...config, activeConnection: next });
};

export const readClipboardLookups = async (): Promise<boolean> => {
  const config = await getConfig();
  return config.clipboardLookups ?? DEFAULT_CLIPBOARD_LOOKUPS;
};

export const writeClipboardLookups = async (
  enabled: boolean
): Promise<boolean> => {
  const next = z.boolean().parse(enabled);
  const config = await getConfig();
  await saveConfig({ ...config, clipboardLookups: next });
  return next;
};
