import { describe, expect, it } from "vitest";

import {
  DEFAULT_WORKSPACE_MODE,
  getWorkspaceMode,
  saveWorkspaceMode,
} from "@/lib/workspace-mode";

const uniqueConnectionId = (suffix: string): string =>
  `wm-test-${suffix}-${crypto.randomUUID()}`;

describe("workspace mode persistence", () => {
  it("returns the default mode when nothing is stored", () => {
    const id = uniqueConnectionId("default");
    expect(getWorkspaceMode(id)).toBe(DEFAULT_WORKSPACE_MODE);
  });

  it("round-trips a saved mode", () => {
    const id = uniqueConnectionId("roundtrip");
    saveWorkspaceMode(id, "chat");
    expect(getWorkspaceMode(id)).toBe("chat");
  });

  it("falls back to default when stored value is invalid", () => {
    const id = uniqueConnectionId("invalid");
    localStorage.setItem(`oh-my-query-workspace-mode-${id}`, "not-a-real-mode");
    expect(getWorkspaceMode(id)).toBe(DEFAULT_WORKSPACE_MODE);
  });

  it("scopes per connection id", () => {
    const id = uniqueConnectionId("scope");
    const other = uniqueConnectionId("scope-other");
    saveWorkspaceMode(id, "chat");
    expect(getWorkspaceMode(other)).toBe(DEFAULT_WORKSPACE_MODE);
  });
});
