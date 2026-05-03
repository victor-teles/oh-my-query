import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { DatabaseConnection } from "@/lib/connections";

import { useConnection } from "@/contexts/connection-context";
import { useEditorInsert } from "@/contexts/editor-insert-context";
import { useSafeMode } from "@/contexts/safe-mode-context";
import { mockTauri } from "@/test/tauri-mock";

import { WorkspaceProviders } from "./workspace-providers";

const connection: DatabaseConnection = {
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

const Probe = () => {
  const c = useConnection();
  const safe = useSafeMode();
  const editor = useEditorInsert();

  return (
    <div>
      <span data-testid="connection-name">{c.connection.name}</span>
      <span data-testid="safe-mode">{safe.enabled ? "on" : "off"}</span>
      <span data-testid="has-editor">{editor ? "yes" : "no"}</span>
    </div>
  );
};

describe("workspace-providers", () => {
  it("composes the connection, safe-mode, and editor providers around children", async () => {
    mockTauri({
      connectToDatabase: vi.fn(),
      getConnections: () => [connection],
      getServerVersion: () => "16.0",
      saveConnections: vi.fn(),
    });

    const screen = render(
      <WorkspaceProviders connection={connection}>
        <Probe />
      </WorkspaceProviders>
    );

    await expect
      .element(screen.getByTestId("connection-name"))
      .toHaveTextContent("Local PG");
    await expect
      .element(screen.getByTestId("safe-mode"))
      .toHaveTextContent("on");
    await expect
      .element(screen.getByTestId("has-editor"))
      .toHaveTextContent("yes");
  });
});
