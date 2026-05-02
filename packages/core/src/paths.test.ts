import type * as NodeOs from "node:os";

import { describe, expect, it, vi } from "vitest";

vi.mock<typeof NodeOs>("node:os", async () => {
  const actual = await vi.importActual<typeof NodeOs>("node:os");
  return {
    ...actual,
    default: { ...actual, homedir: () => "/fake/home" },
    homedir: () => "/fake/home",
  };
});

const {
  appDir,
  configPath,
  connectionsPath,
  historyDir,
  historyPath,
  keyPath,
  tabsPath,
  updateChannelPath,
} = await import("./paths.ts");

const ROOT = "/fake/home/.config/oh-my-query";

describe("paths", () => {
  it.each([
    ["appDir", () => appDir(), ROOT],
    ["configPath", () => configPath(), `${ROOT}/oh-my-query.json`],
    ["connectionsPath", () => connectionsPath(), `${ROOT}/connections.json`],
    ["keyPath", () => keyPath(), `${ROOT}/.key`],
    ["historyDir", () => historyDir(), `${ROOT}/history`],
    [
      "updateChannelPath",
      () => updateChannelPath(),
      `${ROOT}/update-channel.txt`,
    ],
  ])("%s returns the expected path", (_name, builder, expected) => {
    expect(builder()).toBe(expected);
  });

  it("builds per-connection tabs path", () => {
    expect(tabsPath("conn-1")).toBe(`${ROOT}/tabs/conn-1.json`);
  });

  it("builds per-connection history path", () => {
    expect(historyPath("conn-1")).toBe(`${ROOT}/history/conn-1.jsonl`);
  });
});
