import fs from "node:fs/promises";
import path from "node:path";

import { decryptLine, encryptLine, resetCryptoCache } from "./crypto.ts";
import {
  connectionsPath,
  historyDir,
  historyPath,
  keyPath,
  tabsPath,
} from "./paths.ts";

const MAX_HISTORY_ENTRIES = 10_000;
const DEFAULT_ALL_HISTORY_LIMIT = 500;

export interface PersistedTab {
  id: string;
  title: string;
  sql: string;
  sourceDialect: string | null;
}

export interface TabState {
  tabs: PersistedTab[];
  activeTabId: string;
  counter: number;
}

export interface HistoryEntry {
  sql: string;
  connectionId: string;
  dialect?: string | null;
  database: string | null;
  timestamp: string;
  success: boolean;
  error: string | null;
  executionTimeMs: number;
}

export interface HistoryFilters {
  connectionIds?: string[];
  dialects?: string[];
  minRuntimeMs?: number;
  maxRuntimeMs?: number;
  erroredOnly?: boolean;
  query?: string;
  limit?: number;
  offset?: number;
}

export interface DatabaseConnection {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  authSource?: string | null;
  trustServerCertificate?: boolean | null;
  createdAt: string;
  pinned: boolean;
  lastConnectedAt: string | null;
  color?: string;
  emoji?: string;
  environment?: string;
  safeModeEnabled?: boolean;
  piiRedaction?: boolean;
  customPiiPatterns?: string[];
}

const fileLocks = new Map<string, Promise<unknown>>();

async function awaitQuietly(p: Promise<unknown> | undefined): Promise<void> {
  if (!p) {
    return;
  }
  try {
    await p;
  } catch {
    // best-effort: prior holder failure or swallowed error
  }
}

function withFileLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const prev = fileLocks.get(filePath);
  const work = async (): Promise<T> => {
    await awaitQuietly(prev);
    try {
      return await fn();
    } finally {
      // best-effort cleanup; only the latest holder gets to clear the slot
      if (fileLocks.get(filePath) === slot) {
        fileLocks.delete(filePath);
      }
    }
  };
  const slot: Promise<T> = work();
  fileLocks.set(filePath, slot);
  return slot;
}

async function ensureParentDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function atomicWrite(
  filePath: string,
  data: string | Uint8Array
): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, filePath);
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

type DecodedLine =
  | { kind: "empty" }
  | { kind: "plaintext"; entry: HistoryEntry }
  | { kind: "encrypted"; entry: HistoryEntry };

async function decodeLine(line: string): Promise<DecodedLine> {
  const trimmed = line.trim();
  if (!trimmed) {
    return { kind: "empty" };
  }
  if (trimmed.startsWith("{")) {
    try {
      const entry = JSON.parse(trimmed) as HistoryEntry;
      return { entry, kind: "plaintext" };
    } catch {
      return { kind: "empty" };
    }
  }
  const decrypted = await decryptLine(trimmed);
  const entry = JSON.parse(decrypted) as HistoryEntry;
  return { entry, kind: "encrypted" };
}

async function readEntries(
  filePath: string
): Promise<{ entries: HistoryEntry[]; needsMigration: boolean }> {
  const content = await fs.readFile(filePath, "utf8");
  const entries: HistoryEntry[] = [];
  let needsMigration = false;
  for (const line of content.split("\n")) {
    const decoded = await decodeLine(line);
    if (decoded.kind === "plaintext") {
      needsMigration = true;
      entries.push(decoded.entry);
    } else if (decoded.kind === "encrypted") {
      entries.push(decoded.entry);
    }
  }
  return { entries, needsMigration };
}

async function rewriteEncrypted(
  filePath: string,
  entries: HistoryEntry[]
): Promise<void> {
  const lines: string[] = [];
  for (const entry of entries) {
    const enc = await encryptLine(JSON.stringify(entry));
    lines.push(enc);
  }
  await atomicWrite(filePath, `${lines.join("\n")}\n`);
}

async function enforceHistoryLimit(filePath: string): Promise<void> {
  const content = await fs.readFile(filePath, "utf8");
  const lines = content.split("\n");
  const trailingEmpty = lines.length > 0 && lines.at(-1) === "";
  const dataLines = trailingEmpty ? lines.slice(0, -1) : lines;
  if (dataLines.length <= MAX_HISTORY_ENTRIES) {
    return;
  }
  const trimmed = dataLines.slice(dataLines.length - MAX_HISTORY_ENTRIES);
  await atomicWrite(filePath, `${trimmed.join("\n")}\n`);
}

function matchesFilters(entry: HistoryEntry, filters: HistoryFilters): boolean {
  if (
    filters.connectionIds?.length &&
    !filters.connectionIds.includes(entry.connectionId)
  ) {
    return false;
  }
  if (filters.dialects?.length) {
    const dialect = entry.dialect ?? "";
    if (!filters.dialects.includes(dialect)) {
      return false;
    }
  }
  if (
    filters.minRuntimeMs !== undefined &&
    entry.executionTimeMs < filters.minRuntimeMs
  ) {
    return false;
  }
  if (
    filters.maxRuntimeMs !== undefined &&
    entry.executionTimeMs > filters.maxRuntimeMs
  ) {
    return false;
  }
  if (filters.erroredOnly && entry.success) {
    return false;
  }
  if (filters.query) {
    const needle = filters.query.trim().toLowerCase();
    if (needle && !entry.sql.toLowerCase().includes(needle)) {
      return false;
    }
  }
  return true;
}

export async function getTabs(connectionId: string): Promise<TabState | null> {
  const filePath = tabsPath(connectionId);
  if (!(await pathExists(filePath))) {
    return null;
  }
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content) as TabState;
}

export async function saveTabs(
  connectionId: string,
  state: TabState
): Promise<void> {
  const filePath = tabsPath(connectionId);
  await ensureParentDir(filePath);
  await fs.writeFile(filePath, JSON.stringify(state, null, 2));
}

export async function appendHistory(entry: HistoryEntry): Promise<void> {
  const filePath = historyPath(entry.connectionId);
  await ensureParentDir(filePath);
  const encrypted = await encryptLine(JSON.stringify(entry));

  await withFileLock(filePath, async () => {
    await fs.appendFile(filePath, `${encrypted}\n`);
    await enforceHistoryLimit(filePath);
  });
}

export async function getHistory(
  connectionId: string,
  limit: number | null = null,
  offset: number | null = null
): Promise<HistoryEntry[]> {
  const filePath = historyPath(connectionId);
  if (!(await pathExists(filePath))) {
    return [];
  }
  const entries = await withFileLock(filePath, async () => {
    const { entries: read, needsMigration } = await readEntries(filePath);
    if (needsMigration) {
      try {
        await rewriteEncrypted(filePath, read);
      } catch (error) {
        console.warn(
          `failed to migrate history file ${filePath} to encrypted: ${(error as Error).message}`
        );
      }
    }
    return read;
  });

  entries.reverse();
  const start = offset ?? 0;
  const take = limit ?? 100;
  return entries.slice(start, start + take);
}

export async function getAllHistory(
  filters: HistoryFilters = {}
): Promise<HistoryEntry[]> {
  const dir = historyDir();
  if (!(await pathExists(dir))) {
    return [];
  }

  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? DEFAULT_ALL_HISTORY_LIMIT;
  const capacity = offset + limit;
  if (capacity === 0) {
    return [];
  }

  const dirEntries = await fs.readdir(dir);
  const collected: HistoryEntry[] = [];

  for (const name of dirEntries) {
    if (!name.endsWith(".jsonl")) {
      continue;
    }
    const filePath = path.join(dir, name);
    const fileEntries = await withFileLock(filePath, async () => {
      try {
        const { entries, needsMigration } = await readEntries(filePath);
        if (needsMigration) {
          try {
            await rewriteEncrypted(filePath, entries);
          } catch (error) {
            console.warn(
              `failed to migrate history file ${filePath}: ${(error as Error).message}`
            );
          }
        }
        return entries;
      } catch (error) {
        console.warn(
          `failed to read history file ${filePath}: ${(error as Error).message}`
        );
        return [] as HistoryEntry[];
      }
    });
    for (const entry of fileEntries) {
      if (matchesFilters(entry, filters)) {
        collected.push(entry);
      }
    }
  }

  collected.sort((a, b) => {
    if (a.timestamp < b.timestamp) {
      return 1;
    }
    if (a.timestamp > b.timestamp) {
      return -1;
    }
    return 0;
  });
  return collected.slice(offset, offset + limit);
}

function looksLikePlaintextJson(s: string): boolean {
  const t = s.trimStart();
  return t.startsWith("[") || t.startsWith("{");
}

async function writeEncryptedConnections(
  filePath: string,
  connections: DatabaseConnection[]
): Promise<void> {
  await ensureParentDir(filePath);
  const encrypted = await encryptLine(JSON.stringify(connections));
  await atomicWrite(filePath, encrypted);
}

export async function getConnections(): Promise<DatabaseConnection[]> {
  const filePath = connectionsPath();
  if (!(await pathExists(filePath))) {
    return [];
  }
  const content = await fs.readFile(filePath, "utf8");
  const trimmed = content.trim();
  if (!trimmed) {
    return [];
  }
  if (looksLikePlaintextJson(trimmed)) {
    const connections = JSON.parse(trimmed) as DatabaseConnection[];
    try {
      await writeEncryptedConnections(filePath, connections);
    } catch (error) {
      console.warn(
        `failed to migrate connections file ${filePath} to encrypted: ${(error as Error).message}`
      );
    }
    return connections;
  }
  const plaintext = await decryptLine(trimmed);
  return JSON.parse(plaintext) as DatabaseConnection[];
}

export async function saveConnections(
  connections: DatabaseConnection[]
): Promise<void> {
  await writeEncryptedConnections(connectionsPath(), connections);
}

async function unlinkIfExists(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export async function resetSecrets(): Promise<void> {
  await unlinkIfExists(keyPath());
  await unlinkIfExists(connectionsPath());
  await fs.rm(historyDir(), { force: true, recursive: true });
  resetCryptoCache();
}
