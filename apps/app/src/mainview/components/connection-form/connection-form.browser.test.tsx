import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { DatabaseConnection, DatabaseType } from "@/lib/connections";

import { DEFAULT_PORTS } from "@/lib/connections";

import { ConnectionForm } from "./index";

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

const mockTestConnection = vi.fn();
const mockSaveConnection = vi.fn<(c: DatabaseConnection) => Promise<void>>();
const mockUpdateConnection = vi.fn<(c: DatabaseConnection) => Promise<void>>();

vi.mock(import("@/lib/tauri"), async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    testConnection: (params: unknown) => mockTestConnection(params),
  };
});

vi.mock(import("@/lib/connections"), async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    saveConnection: (c: DatabaseConnection) => mockSaveConnection(c),
    updateConnection: (c: DatabaseConnection) => mockUpdateConnection(c),
  };
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

describe("connectionForm test-connection flow", () => {
  beforeEach(() => {
    mockTestConnection.mockReset();
  });

  it("shows a success pill when the test resolves successfully", async () => {
    mockTestConnection.mockResolvedValueOnce({
      latencyMs: 12,
      message: "ok",
      success: true,
    });
    const screen = render(
      <ConnectionForm connection={connectionFor("postgresql")} />
    );

    await screen.getByRole("button", { name: "Test connection" }).click();

    await expect
      .element(screen.getByText(/Connected \(12ms\)/))
      .toBeInTheDocument();
    expect(mockTestConnection).toHaveBeenCalledOnce();
  });

  it("shows an error pill when the test resolves with success=false", async () => {
    mockTestConnection.mockResolvedValueOnce({
      message: "auth failed",
      success: false,
    });
    const screen = render(
      <ConnectionForm connection={connectionFor("postgresql")} />
    );

    await screen.getByRole("button", { name: "Test connection" }).click();

    await expect.element(screen.getByText("auth failed")).toBeInTheDocument();
  });

  it("shows an error pill when the test rejects", async () => {
    mockTestConnection.mockRejectedValueOnce(new Error("network down"));
    const screen = render(
      <ConnectionForm connection={connectionFor("postgresql")} />
    );

    await screen.getByRole("button", { name: "Test connection" }).click();

    await expect.element(screen.getByText("network down")).toBeInTheDocument();
  });
});

describe("connectionForm submit flow", () => {
  beforeEach(() => {
    mockSaveConnection.mockReset();
    mockUpdateConnection.mockReset();
  });

  it("calls saveConnection + onSuccess when submitting a new connection", async () => {
    const onSuccess = vi.fn();
    const screen = render(<ConnectionForm onSuccess={onSuccess} />);

    await screen.getByLabelText("Connection name").fill("Local PG");
    await screen.getByRole("textbox", { name: "Database" }).fill("app");
    await screen.getByRole("button", { name: "Save connection" }).click();

    await vi.waitFor(() => {
      expect(mockSaveConnection).toHaveBeenCalledOnce();
      expect(onSuccess).toHaveBeenCalledOnce();
    });
    const saved = mockSaveConnection.mock.calls[0]?.[0] as DatabaseConnection;
    expect(saved.name).toBe("Local PG");
    expect(saved.database).toBe("app");
    expect(saved.type).toBe("postgresql");
  });

  it("calls updateConnection + onSuccess when editing an existing connection", async () => {
    const onSuccess = vi.fn();
    const screen = render(
      <ConnectionForm
        connection={connectionFor("postgresql")}
        onSuccess={onSuccess}
      />
    );

    await screen.getByRole("button", { name: "Update connection" }).click();

    await vi.waitFor(() => {
      expect(mockUpdateConnection).toHaveBeenCalledOnce();
      expect(onSuccess).toHaveBeenCalledOnce();
    });
    const updated = mockUpdateConnection.mock
      .calls[0]?.[0] as DatabaseConnection;
    expect(updated.id).toBe("test-postgresql");
    expect(updated.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("connectionForm appearance section", () => {
  it(
    "selects an emoji from the picker and clears it",
    { timeout: 30_000 },
    async () => {
      const screen = render(
        <ConnectionForm connection={connectionFor("postgresql")} />
      );

      await screen.getByRole("button", { name: "Appearance" }).click();
      const trigger = screen.getByRole("button", { name: "Choose emoji" });
      await trigger.click();

      await screen.getByRole("button", { name: "Select 🦆" }).click();

      await expect.element(trigger).toHaveTextContent("🦆");

      await trigger.click();
      await screen.getByRole("button", { name: "Clear" }).click();

      expect(trigger.element().textContent?.trim()).toBe("🐘");
    }
  );

  it("selects a color swatch and toggles back to none", async () => {
    const screen = render(
      <ConnectionForm connection={connectionFor("postgresql")} />
    );

    await screen.getByRole("button", { name: "Appearance" }).click();

    const honey = screen.getByRole("button", { name: "honey" });
    await honey.click();
    expect(honey.element().getAttribute("aria-pressed")).toBe("true");

    const none = screen.getByRole("button", { name: "No color" });
    await none.click();
    expect(none.element().getAttribute("aria-pressed")).toBe("true");
    expect(honey.element().getAttribute("aria-pressed")).toBe("false");
  });
});

describe("connectionForm AI context section", () => {
  it("auto-enables PII redaction when env switches to prod", async () => {
    const screen = render(<ConnectionForm />);

    await screen.getByRole("button", { name: "AI context" }).click();
    expect(screen.getByLabelText("Custom patterns").query()).toBeNull();

    await screen.getByLabelText("Environment").click();
    await screen.getByRole("option", { name: "Prod" }).click();

    await expect
      .element(screen.getByLabelText("Custom patterns"))
      .toBeInTheDocument();
  });

  it("renders the patterns textarea when piiRedaction is saved as true", () => {
    const conn: DatabaseConnection = {
      ...connectionFor("postgresql"),
      customPiiPatterns: ["customer_\\d+"],
      piiRedaction: true,
    };
    const screen = render(<ConnectionForm connection={conn} />);

    const textarea = screen
      .getByLabelText("Custom patterns")
      .element() as HTMLTextAreaElement;
    expect(textarea.value).toBe("customer_\\d+");
  });
});
