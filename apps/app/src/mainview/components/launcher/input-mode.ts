import type { LookupValue } from "@conch/core/client";

import { classifyLookupValue } from "@conch/core/client";

export type LauncherInput =
  | { mode: "search"; text: string; lookup: LookupValue | null }
  | { mode: "sql"; sql: string }
  | { mode: "table"; needle: string }
  | { mode: "connection"; needle: string };

export type InputMode = LauncherInput["mode"];

const CONNECTION_TOKEN = /^@(\S*)$/;

export const parseLauncherInput = (raw: string): LauncherInput => {
  const text = raw.trimStart();
  if (text.startsWith(">")) {
    return { mode: "sql", sql: text.slice(1).trim() };
  }
  if (text.startsWith("#")) {
    return { mode: "table", needle: text.slice(1).trim() };
  }
  const connection = CONNECTION_TOKEN.exec(text);
  if (connection) {
    return { mode: "connection", needle: connection[1] ?? "" };
  }
  return { lookup: classifyLookupValue(raw), mode: "search", text: raw };
};

export const SQL_PREFIX = "> ";
