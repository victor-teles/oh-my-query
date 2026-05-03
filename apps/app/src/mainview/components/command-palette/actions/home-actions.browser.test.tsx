import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { CommandAction } from "@/components/command-palette/types";
import type { DatabaseConnection } from "@/lib/connections";

import {
  CommandPaletteProvider,
  useCommandPalette,
} from "@/components/command-palette/command-palette-provider";

import { HomeActions } from "./home-actions";

const navigate = vi.fn();
vi.mock(import("@tanstack/react-router"), () => ({
  useNavigate: () => navigate,
}));

const captured: { actions: CommandAction[] } = { actions: [] };

const Capture = () => {
  const { actions } = useCommandPalette();
  captured.actions = actions;
  return null;
};

const conn = (
  overrides: Partial<DatabaseConnection> = {}
): DatabaseConnection => ({
  createdAt: "2024-01-01T00:00:00.000Z",
  database: "app",
  host: "localhost",
  id: "c1",
  lastConnectedAt: null,
  name: "Local PG",
  password: "",
  pinned: false,
  port: 5432,
  type: "postgresql",
  username: "postgres",
  ...overrides,
});

const renderWith = (connections: DatabaseConnection[], onOpenAdd = vi.fn()) => {
  captured.actions = [];
  return render(
    <CommandPaletteProvider>
      <HomeActions connections={connections} onOpenAdd={onOpenAdd} />
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

describe("home-actions", () => {
  it("registers New Connection plus one Open per connection", () => {
    renderWith([
      conn({ id: "a", name: "Alpha" }),
      conn({ id: "b", name: "Beta" }),
    ]);

    const ids = captured.actions.map((a) => a.id);
    expect(ids).toContain("connection.new");
    expect(ids).toContain("connection.open.a");
    expect(ids).toContain("connection.open.b");
  });

  it("new Connection perform invokes onOpenAdd", async () => {
    const onOpenAdd = vi.fn();
    renderWith([], onOpenAdd);

    await findAction("connection.new").perform();
    expect(onOpenAdd).toHaveBeenCalledOnce();
  });

  it("open <connection> perform navigates to /workspace/$connectionId", async () => {
    navigate.mockClear();
    renderWith([conn({ id: "abc", name: "Prod" })]);

    await findAction("connection.open.abc").perform();
    expect(navigate).toHaveBeenCalledExactlyOnceWith({
      params: { connectionId: "abc" },
      to: "/workspace/$connectionId",
    });
  });
});
