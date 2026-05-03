import type * as ReactRouter from "@tanstack/react-router";

import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { CommandAction } from "@/components/command-palette/types";

import {
  CommandPaletteProvider,
  useCommandPalette,
} from "@/components/command-palette/command-palette-provider";

import { WorkspaceLayoutActions } from "./workspace-actions";

const navigate = vi.fn();
vi.mock(import("@tanstack/react-router"), () => {
  const mocks = {
    useLocation: () => ({ search: {} }),
    useNavigate: () => navigate,
  };
  return mocks as unknown as Partial<typeof ReactRouter>;
});

const captured: { actions: CommandAction[] } = { actions: [] };

const Capture = () => {
  const { actions } = useCommandPalette();
  captured.actions = actions;
  return null;
};

interface RenderProps {
  mode?: "editor" | "split" | "chat";
  setMode?: (next: "editor" | "split" | "chat") => void;
  onToggleSidebar?: () => void;
  onShowShortcuts?: () => void;
  onReconnect?: () => void;
  connectionName?: string;
}

const renderActions = (props: RenderProps = {}) => {
  captured.actions = [];
  return render(
    <CommandPaletteProvider>
      <WorkspaceLayoutActions
        connectionName={props.connectionName ?? "Local PG"}
        mode={props.mode ?? "editor"}
        onReconnect={props.onReconnect ?? vi.fn()}
        onShowShortcuts={props.onShowShortcuts ?? vi.fn()}
        onToggleSidebar={props.onToggleSidebar ?? vi.fn()}
        setMode={props.setMode ?? vi.fn()}
      />
      <Capture />
    </CommandPaletteProvider>
  );
};

const findAction = (id: string): CommandAction => {
  const action = captured.actions.find((a) => a.id === id);
  if (!action) {
    throw new Error(`Missing action: ${id}`);
  }
  return action;
};

describe("workspace-layout-actions", () => {
  it("registers core view, mode, shortcuts, and reconnect actions", () => {
    renderActions();
    const ids = captured.actions.map((a) => a.id);

    expect(ids).toStrictEqual(
      expect.arrayContaining([
        "view.toggle-sidebar",
        "view.query-history",
        "view.mode.editor",
        "view.mode.split",
        "view.mode.chat",
        "view.shortcuts",
        "connection.reconnect",
      ])
    );
  });

  it("hides the current mode action via when()", () => {
    renderActions({ mode: "split" });

    expect(findAction("view.mode.editor").when?.()).toBeTruthy();
    expect(findAction("view.mode.split").when?.()).toBeFalsy();
    expect(findAction("view.mode.chat").when?.()).toBeTruthy();
  });

  it("toggle-sidebar perform invokes onToggleSidebar", async () => {
    const onToggleSidebar = vi.fn();
    renderActions({ onToggleSidebar });
    await findAction("view.toggle-sidebar").perform();
    expect(onToggleSidebar).toHaveBeenCalledOnce();
  });

  it("setMode perform calls setMode with the chosen mode", async () => {
    const setMode = vi.fn();
    renderActions({ setMode });

    await findAction("view.mode.split").perform();
    expect(setMode).toHaveBeenLastCalledWith("split");

    await findAction("view.mode.chat").perform();
    expect(setMode).toHaveBeenLastCalledWith("chat");
  });

  it("open Query History navigates with history=open", async () => {
    navigate.mockClear();
    renderActions();

    await findAction("view.query-history").perform();
    expect(navigate).toHaveBeenCalledOnce();
  });

  it("reconnect label includes the connection name", () => {
    renderActions({ connectionName: "Prod-PG" });
    expect(findAction("connection.reconnect").label).toBe(
      "Reconnect to Prod-PG"
    );
  });

  it("reconnect perform invokes onReconnect", async () => {
    const onReconnect = vi.fn();
    renderActions({ onReconnect });
    await findAction("connection.reconnect").perform();
    expect(onReconnect).toHaveBeenCalledOnce();
  });
});
