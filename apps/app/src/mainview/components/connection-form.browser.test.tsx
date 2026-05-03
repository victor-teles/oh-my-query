import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

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
    const screen = render(
      <ConnectionForm connection={connectionFor("duckdb")} />
    );

    expect(screen.getByLabelText("Host").query()).toBeNull();
    expect(screen.getByLabelText("Port").query()).toBeNull();
    expect(screen.getByLabelText("Username").query()).toBeNull();
    expect(screen.getByLabelText("Password").query()).toBeNull();
  });

  it("shows a File path field with a :memory: placeholder for DuckDB", () => {
    const screen = render(
      <ConnectionForm connection={connectionFor("duckdb")} />
    );

    const db = screen.getByLabelText("File path").element() as HTMLInputElement;
    expect(db.placeholder).toContain(":memory:");
  });

  it("renders MSSQL form with host/port/username/password and sa placeholder", () => {
    const screen = render(
      <ConnectionForm connection={connectionFor("mssql")} />
    );

    expect(screen.getByLabelText("Host")).toBeInTheDocument();
    const port = screen.getByLabelText("Port").element() as HTMLInputElement;
    expect(port.value).toBe("1433");

    const username = screen
      .getByLabelText("Username")
      .element() as HTMLInputElement;
    expect(username.placeholder).toBe("sa");
  });

  it("renders trust-server-certificate checkbox defaulted on for MSSQL", () => {
    const screen = render(
      <ConnectionForm connection={connectionFor("mssql")} />
    );
    const checkbox = screen
      .getByLabelText("Trust server certificate")
      .element() as HTMLInputElement;
    expect(checkbox).toBeInTheDocument();
    expect(checkbox.checked).toBeTruthy();
  });

  it("hides trust-server-certificate checkbox for non-MSSQL engines", () => {
    const screen = render(
      <ConnectionForm connection={connectionFor("postgresql")} />
    );
    expect(
      screen.getByLabelText("Trust server certificate").query()
    ).toBeNull();
  });

  it("preserves trust-server-certificate=false from a saved connection", () => {
    const conn: DatabaseConnection = {
      ...connectionFor("mssql"),
      trustServerCertificate: false,
    };
    const screen = render(<ConnectionForm connection={conn} />);
    const checkbox = screen
      .getByLabelText("Trust server certificate")
      .element() as HTMLInputElement;
    expect(checkbox.checked).toBeFalsy();
  });

  it("renders ClickHouse form with host/port/username/password and port 8123", () => {
    const screen = render(
      <ConnectionForm connection={connectionFor("clickhouse")} />
    );

    expect(screen.getByLabelText("Host")).toBeInTheDocument();
    const port = screen.getByLabelText("Port").element() as HTMLInputElement;
    expect(port.value).toBe("8123");

    const username = screen
      .getByLabelText("Username")
      .element() as HTMLInputElement;
    expect(username.placeholder).toBe("default");
  });
});

describe("connectionForm inline validation", () => {
  it("shows an inline alert when Test connection is clicked with an empty name", async () => {
    const screen = render(<ConnectionForm />);

    await screen.getByRole("button", { name: "Test connection" }).click();

    const alert = screen.getByRole("alert");
    await expect.element(alert).toBeInTheDocument();
    expect(alert.element().textContent).toContain(
      "Connection name is required"
    );
  });

  it("clears the inline alert once the user edits a field", async () => {
    const screen = render(<ConnectionForm />);

    await screen.getByRole("button", { name: "Test connection" }).click();
    await expect.element(screen.getByRole("alert")).toBeInTheDocument();

    await screen.getByLabelText("Connection name").fill("Local");
    expect(screen.getByRole("alert").query()).toBeNull();
  });
});
