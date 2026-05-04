import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { RunConfig } from "@/lib/query-types";

import { DEFAULT_RUN_CONFIG } from "@/lib/query-types";

// oxlint-disable-next-line prefer-const, jest/require-hook
let runConfig: RunConfig = { ...DEFAULT_RUN_CONFIG };
const setRunConfig = vi.fn((partial: Partial<RunConfig>) => {
  runConfig = { ...runConfig, ...partial };
});

vi.mock(import("@/contexts/connection-context"), () => ({
  useConnection: () => ({
    connection: {
      createdAt: "2026-01-01T00:00:00.000Z",
      database: "app",
      host: "localhost",
      id: "conn-1",
      lastConnectedAt: null,
      name: "Local",
      password: "",
      pinned: false,
      port: 5432,
      type: "postgresql" as const,
      username: "postgres",
    },
    error: null,
    isConnected: true,
    isConnecting: false,
    isReconnecting: false,
    reconnect: vi.fn(),
    runConfig,
    serverVersion: null,
    setRunConfig,
  }),
}));

const { RunConfigPopover } = await import("./run-config-popover");

describe("runConfigPopover", () => {
  beforeEach(() => {
    runConfig = { ...DEFAULT_RUN_CONFIG };
    setRunConfig.mockClear();
  });

  it("opens the popover and toggles sandbox", async () => {
    const screen = render(<RunConfigPopover connectionType="postgresql" />);
    await screen.getByLabelText("Run options").click();
    const checkbox = screen.getByRole("checkbox");
    await checkbox.click();
    expect(setRunConfig).toHaveBeenCalledWith({ sandbox: false });
  });

  it("hides the schema field for mongodb", async () => {
    const screen = render(<RunConfigPopover connectionType="mongodb" />);
    await screen.getByLabelText("Run options").click();
    expect(screen.getByLabelText("Default schema").query()).toBeNull();
  });

  it("shows the schema field for postgres", async () => {
    const screen = render(<RunConfigPopover connectionType="postgresql" />);
    await screen.getByLabelText("Run options").click();
    expect(screen.getByLabelText("Default schema").element()).toBeVisible();
  });

  it("flags an active dot when runConfig deviates from defaults", () => {
    runConfig = { ...DEFAULT_RUN_CONFIG, timeoutSecs: 30 };
    const screen = render(<RunConfigPopover connectionType="postgresql" />);
    const trigger = screen.getByLabelText("Run options").element();
    const dot = trigger.querySelector("[aria-hidden='true']");
    expect(dot).not.toBeNull();
  });
});
