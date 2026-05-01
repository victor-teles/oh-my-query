import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { DatabaseConnection, DatabaseType } from "@/lib/connections";

import { DEFAULT_PORTS } from "@/lib/connections";

import { ConnectionForm } from "./connection-form";

const SERVERLESS = new Set<DatabaseType>(["duckdb", "sqlite"]);
const PASSWORDLESS = new Set<DatabaseType>(["duckdb", "sqlite", "redis"]);

const connectionFor = (type: DatabaseType): DatabaseConnection => ({
  createdAt: "2026-01-01T00:00:00.000Z",
  database: type === "duckdb" ? ":memory:" : "app",
  host: SERVERLESS.has(type) ? "" : "localhost",
  id: `test-${type}`,
  lastConnectedAt: null,
  name: `Test ${type}`,
  password: "",
  pinned: false,
  port: DEFAULT_PORTS[type],
  type,
  username: PASSWORDLESS.has(type) ? "" : "user",
});

describe("connectionForm engine variants", () => {
  it("hides server fields for DuckDB", () => {
    render(<ConnectionForm connection={connectionFor("duckdb")} />);

    expect(screen.queryByLabelText("Host")).toBeNull();
    expect(screen.queryByLabelText("Port")).toBeNull();
    expect(screen.queryByLabelText("Username")).toBeNull();
    expect(screen.queryByLabelText("Password")).toBeNull();
  });

  it("shows a File path field with a :memory: placeholder for DuckDB", () => {
    render(<ConnectionForm connection={connectionFor("duckdb")} />);

    const db = screen.getByLabelText("File path") as HTMLInputElement;
    expect(db.placeholder).toContain(":memory:");
  });

  it("renders MSSQL form with host/port/username/password and sa placeholder", () => {
    render(<ConnectionForm connection={connectionFor("mssql")} />);

    expect(screen.getByLabelText("Host")).toBeDefined();
    const port = screen.getByLabelText("Port") as HTMLInputElement;
    expect(port.value).toBe("1433");

    const username = screen.getByLabelText("Username") as HTMLInputElement;
    expect(username.placeholder).toBe("sa");
  });

  it("renders trust-server-certificate checkbox defaulted on for MSSQL", () => {
    render(<ConnectionForm connection={connectionFor("mssql")} />);
    const checkbox = screen.getByLabelText(
      "Trust server certificate"
    ) as HTMLInputElement;
    expect(checkbox).toBeDefined();
    expect(checkbox.checked).toBeTruthy();
  });

  it("hides trust-server-certificate checkbox for non-MSSQL engines", () => {
    render(<ConnectionForm connection={connectionFor("postgresql")} />);
    expect(screen.queryByLabelText("Trust server certificate")).toBeNull();
  });

  it("preserves trust-server-certificate=false from a saved connection", () => {
    const conn: DatabaseConnection = {
      ...connectionFor("mssql"),
      trustServerCertificate: false,
    };
    render(<ConnectionForm connection={conn} />);
    const checkbox = screen.getByLabelText(
      "Trust server certificate"
    ) as HTMLInputElement;
    expect(checkbox.checked).toBeFalsy();
  });

  it("renders ClickHouse form with host/port/username/password and port 8123", () => {
    render(<ConnectionForm connection={connectionFor("clickhouse")} />);

    expect(screen.getByLabelText("Host")).toBeDefined();
    const port = screen.getByLabelText("Port") as HTMLInputElement;
    expect(port.value).toBe("8123");

    const username = screen.getByLabelText("Username") as HTMLInputElement;
    expect(username.placeholder).toBe("default");
  });
});

describe("connectionForm inline validation", () => {
  it("shows an inline alert when Test connection is clicked with an empty name", async () => {
    const user = userEvent.setup();
    render(<ConnectionForm />);

    await user.click(screen.getByRole("button", { name: "Test connection" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Connection name is required");
  });

  it("clears the inline alert once the user edits a field", async () => {
    const user = userEvent.setup();
    render(<ConnectionForm />);

    await user.click(screen.getByRole("button", { name: "Test connection" }));
    await expect(screen.findByRole("alert")).resolves.toBeDefined();

    await user.type(screen.getByLabelText("Connection name"), "Local");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
