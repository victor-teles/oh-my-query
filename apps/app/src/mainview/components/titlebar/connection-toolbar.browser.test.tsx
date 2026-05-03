import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { DatabaseConnection } from "@/lib/connections";

import { SafeModeProvider } from "@/contexts/safe-mode-context";

import { ConnectionToolbar } from "./connection-toolbar";

const navigate = vi.fn();

vi.mock(import("@tanstack/react-router"), () => ({
  useNavigate: () => navigate,
}));

const baseConnection: DatabaseConnection = {
  createdAt: "2024-01-01T00:00:00.000Z",
  database: "app",
  host: "localhost",
  id: "conn-1",
  lastConnectedAt: null,
  name: "Local PG",
  password: "",
  pinned: false,
  port: 5432,
  type: "postgresql",
  username: "postgres",
};

const renderToolbar = (
  overrides: Partial<React.ComponentProps<typeof ConnectionToolbar>> = {}
) =>
  render(
    <SafeModeProvider>
      <ConnectionToolbar
        connection={baseConnection}
        onShowShortcuts={overrides.onShowShortcuts ?? vi.fn()}
        onWorkspaceModeChange={overrides.onWorkspaceModeChange ?? vi.fn()}
        workspaceMode={overrides.workspaceMode ?? "editor"}
      />
    </SafeModeProvider>
  );

describe("connection-toolbar", () => {
  it("renders mode toggle and tooltip-backed action buttons", () => {
    const screen = renderToolbar();

    expect(screen.getByRole("tab", { name: /editor/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /keyboard shortcuts/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /disable safe mode/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /disconnect/i })
    ).toBeInTheDocument();
  });

  it("calls onShowShortcuts when the shortcuts button is clicked", async () => {
    const onShowShortcuts = vi.fn();
    const screen = renderToolbar({ onShowShortcuts });

    await screen.getByRole("button", { name: /keyboard shortcuts/i }).click();

    expect(onShowShortcuts).toHaveBeenCalledOnce();
  });

  it("toggles the safe-mode aria-label when clicked", async () => {
    const screen = renderToolbar();

    const safeButton = screen.getByRole("button", {
      name: /disable safe mode/i,
    });
    await safeButton.click();

    expect(
      screen.getByRole("button", { name: /enable safe mode/i })
    ).toBeInTheDocument();
  });

  it("navigates home when disconnect is clicked", async () => {
    navigate.mockClear();
    const screen = renderToolbar();

    await screen.getByRole("button", { name: /disconnect/i }).click();

    expect(navigate).toHaveBeenCalledExactlyOnceWith({ to: "/" });
  });
});
