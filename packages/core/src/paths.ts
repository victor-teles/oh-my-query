import { homedir } from "node:os";
import path from "node:path";

const APP_DIR = ".config/conch";

export function appDir(): string {
  return path.join(homedir(), APP_DIR);
}

export function configPath(): string {
  return path.join(appDir(), "conch.json");
}

export function connectionsPath(): string {
  return path.join(appDir(), "connections.json");
}

export function keyPath(): string {
  return path.join(appDir(), ".key");
}

export function tabsPath(connectionId: string): string {
  return path.join(appDir(), "tabs", `${connectionId}.json`);
}

export function historyDir(): string {
  return path.join(appDir(), "history");
}

export function historyPath(connectionId: string): string {
  return path.join(historyDir(), `${connectionId}.jsonl`);
}

export function updateChannelPath(): string {
  return path.join(appDir(), "update-channel.txt");
}

export function aiConfigPath(): string {
  return path.join(appDir(), "ai.enc");
}

export function widgetsPath(): string {
  return path.join(appDir(), "widgets.enc");
}

export function recentAsksPath(): string {
  return path.join(appDir(), "recent-asks.enc");
}

export function boardsPath(): string {
  return path.join(appDir(), "boards.enc");
}

export function boardFramesPath(): string {
  return path.join(appDir(), "board-frames.json");
}
