import { homedir } from "node:os";
import path from "node:path";

const APP_DIR = ".config/oh-my-query";

export function appDir(): string {
  return path.join(homedir(), APP_DIR);
}

export function configPath(): string {
  return path.join(appDir(), "oh-my-query.json");
}

export function connectionsPath(): string {
  return path.join(appDir(), "connections.json");
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
