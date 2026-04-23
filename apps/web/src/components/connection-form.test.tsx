import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type {
  DatabaseConnection,
  DatabaseType,
} from "@/lib/connections";

import { ConnectionForm } from "./connection-form";

const connectionFor = (type: DatabaseType): DatabaseConnection => ({
  createdAt: "2026-01-01T00:00:00.000Z",
  database: type === "duckdb" ? ":memory:" : "app",
  host: type === "duckdb" || type === "sqlite" ? "" : "localhost",
  id: `test-${type}`,
  lastConnectedAt: null,
  name: `Test ${type}`,
  password: "",
  pinned: false,
  port:
    type === "duckdb" || type === "sqlite"
      ? 0
      : type === "mssql"
        ? 1433
        : type === "clickhouse"
          ? 8123
          : 5432,
  type,
  username: type === "duckdb" || type === "sqlite" || type === "redis" ? "" : "user",
});

describe("ConnectionForm engine variants", () => {
  it("renders DuckDB form without host/port/username/password, with File path label and :memory: hint", () => {
    render(<ConnectionForm connection={connectionFor("duckdb")} />);

    expect(screen.queryByLabelText("Host")).toBeNull();
    expect(screen.queryByLabelText("Port")).toBeNull();
    expect(screen.queryByLabelText("Username")).toBeNull();
    expect(screen.queryByLabelText("Password")).toBeNull();

    expect(screen.getByLabelText("File path")).toBeDefined();

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

    expect(screen.getByLabelText("Password")).toBeDefined();
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
