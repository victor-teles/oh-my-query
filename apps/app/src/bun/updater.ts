import type { AvailableUpdate, UpdateChannel } from "@oh-my-query/rpc";

import { DbError, updateChannelPath } from "@oh-my-query/core";
import fs from "node:fs/promises";
import path from "node:path";

const APPCAST_BASE =
  "https://github.com/victor-teles/oh-my-query/releases/download";

const VALID_CHANNELS = new Set<UpdateChannel>(["stable", "beta", "nightly"]);

function normalize(value: string | null | undefined): UpdateChannel {
  if (!value) {
    return "stable";
  }
  const lower = value.trim().toLowerCase() as UpdateChannel;
  return VALID_CHANNELS.has(lower) ? lower : "stable";
}

export async function readChannel(): Promise<UpdateChannel> {
  try {
    const content = await fs.readFile(updateChannelPath(), "utf8");
    return normalize(content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "stable";
    }
    throw error;
  }
}

export async function writeChannel(channel: string): Promise<UpdateChannel> {
  if (!VALID_CHANNELS.has(channel as UpdateChannel)) {
    throw new DbError("INVALID_CHANNEL", `Unknown update channel: ${channel}`);
  }
  const filePath = updateChannelPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, channel);
  return channel as UpdateChannel;
}

export function appcastUrl(channel: UpdateChannel): string {
  return `${APPCAST_BASE}/updater-${channel}/latest.json`;
}

// NOTE: Electrobun's Updater API integration is deferred to a follow-up.
// Today we only persist/read the channel and expose the appcast URL — the
// actual `check`/`installAndRestart` calls land alongside the GitHub
// release-pipeline manifest work (see migration plan section 15).
export function checkForUpdate(): Promise<AvailableUpdate | null> {
  return Promise.resolve(null);
}

export function installUpdate(): Promise<boolean> {
  return Promise.resolve(false);
}
