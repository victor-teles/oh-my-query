import fs from "node:fs/promises";

import type { AISettings } from "./config.ts";

import { getConfig, saveConfig } from "./config.ts";
import { decryptLine, encryptLine } from "./crypto.ts";
import {
  atomicWrite,
  ensureParentDir,
  pathExists,
  withFileLock,
} from "./fs-utils.ts";
import { aiConfigPath } from "./paths.ts";

export type AiSettings = AISettings;

export interface AiSettingsUpdate {
  provider: string;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface RedactedAiSettingsRecord {
  provider: string;
  model: string | null;
  baseUrl: string | null;
  hasKey: boolean;
  keyHint: string | null;
}

const MIN_KEY_LENGTH_FOR_HINT = 12;
const HINT_LENGTH = 4;

const readEncrypted = async (filePath: string): Promise<AiSettings | null> => {
  if (!(await pathExists(filePath))) {
    return null;
  }
  const raw = await fs.readFile(filePath, "utf8");
  const content = raw.trim();
  if (!content) {
    return null;
  }
  return JSON.parse(await decryptLine(content)) as AiSettings;
};

const writeEncrypted = async (
  filePath: string,
  settings: AiSettings
): Promise<void> => {
  await ensureParentDir(filePath);
  await atomicWrite(filePath, await encryptLine(JSON.stringify(settings)));
};

// Older builds stored the key in plaintext oh-my-query.json; move it into
// ai.enc (unless a newer encrypted copy exists) and strip it from the file.
const migrateLegacy = async (
  filePath: string,
  current: AiSettings | null
): Promise<AiSettings | null> => {
  const config = await getConfig();
  if (!config.ai) {
    return current;
  }
  const migrated = current ?? config.ai;
  if (!current) {
    await writeEncrypted(filePath, migrated);
  }
  const { ai: _legacy, ...rest } = config;
  await saveConfig(rest);
  return migrated;
};

const loadUnlocked = async (filePath: string): Promise<AiSettings | null> =>
  migrateLegacy(filePath, await readEncrypted(filePath));

export function getAiSettings(): Promise<AiSettings | null> {
  const filePath = aiConfigPath();
  return withFileLock(filePath, () => loadUnlocked(filePath));
}

const blankToUndefined = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed || undefined;
};

export const mergeAiSettings = (
  current: AiSettings | null,
  update: AiSettingsUpdate
): AiSettings => {
  const sameProvider = current?.provider === update.provider;
  const keptKey = sameProvider ? current.apiKey : "";
  return {
    apiKey: update.apiKey === undefined ? keptKey : update.apiKey.trim(),
    baseUrl: blankToUndefined(update.baseUrl),
    model: blankToUndefined(update.model),
    provider: update.provider,
  };
};

export function saveAiSettings(update: AiSettingsUpdate): Promise<AiSettings> {
  const filePath = aiConfigPath();
  return withFileLock(filePath, async () => {
    const next = mergeAiSettings(await loadUnlocked(filePath), update);
    await writeEncrypted(filePath, next);
    return next;
  });
}

export function clearAiKey(): Promise<AiSettings | null> {
  const filePath = aiConfigPath();
  return withFileLock(filePath, async () => {
    const current = await loadUnlocked(filePath);
    if (!current) {
      return null;
    }
    const next = { ...current, apiKey: "" };
    await writeEncrypted(filePath, next);
    return next;
  });
}

export const redactAiSettings = (
  settings: AiSettings | null
): RedactedAiSettingsRecord | null => {
  if (!settings) {
    return null;
  }
  const key = settings.apiKey;
  return {
    baseUrl: settings.baseUrl ?? null,
    hasKey: key.length > 0,
    keyHint:
      key.length >= MIN_KEY_LENGTH_FOR_HINT ? key.slice(-HINT_LENGTH) : null,
    model: settings.model ?? null,
    provider: settings.provider,
  };
};
