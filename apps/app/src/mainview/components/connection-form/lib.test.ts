import { describe, expect, it } from "vitest";

import { INITIAL_STATE } from "./connection-form-state";
import {
  buildConnection,
  buildConnectionParams,
  effectivePiiEnabled,
  getDatabaseHint,
  getDatabaseLabel,
  getDatabasePlaceholder,
  getErrorMessage,
  getUsernamePlaceholder,
  parseCustomPiiPatterns,
  validate,
} from "./lib";

describe("effectivePiiEnabled", () => {
  it("returns the explicit value when set", () => {
    expect(effectivePiiEnabled(true, "")).toBeTruthy();
    expect(effectivePiiEnabled(false, "prod")).toBeFalsy();
  });

  it("auto-enables for prod when undefined", () => {
    expect(effectivePiiEnabled(undefined, "prod")).toBeTruthy();
  });

  it("stays off for non-prod when undefined", () => {
    expect(effectivePiiEnabled(undefined, "dev")).toBeFalsy();
    expect(effectivePiiEnabled(undefined, "staging")).toBeFalsy();
    expect(effectivePiiEnabled(undefined, "")).toBeFalsy();
  });
});

describe("parseCustomPiiPatterns", () => {
  it("returns undefined for empty input", () => {
    expect(parseCustomPiiPatterns("")).toBeUndefined();
    expect(parseCustomPiiPatterns("   \n  \n")).toBeUndefined();
  });

  it("trims, drops blank and #-prefixed comment lines", () => {
    expect(
      parseCustomPiiPatterns("# header\n  email_\\d+\n\n  # inline\nphone")
    ).toStrictEqual(["email_\\d+", "phone"]);
  });
});

describe("validate", () => {
  it("requires a name", () => {
    expect(validate({ ...INITIAL_STATE, name: "  " })).toBe(
      "Connection name is required"
    );
  });

  it("requires a database for non-redis types", () => {
    expect(validate({ ...INITIAL_STATE, database: "", name: "x" })).toBe(
      "Database name is required"
    );
  });

  it("does not require a database for redis", () => {
    expect(
      validate({
        ...INITIAL_STATE,
        database: "",
        host: "localhost",
        name: "x",
        type: "redis",
      })
    ).toBeNull();
  });

  it("requires a host for hosted types", () => {
    expect(
      validate({
        ...INITIAL_STATE,
        database: "app",
        host: "",
        name: "x",
      })
    ).toBe("Host is required");
  });

  it("does not require a host for serverless types", () => {
    expect(
      validate({
        ...INITIAL_STATE,
        database: ":memory:",
        host: "",
        name: "x",
        type: "duckdb",
      })
    ).toBeNull();
  });
});

describe("buildConnection", () => {
  it("strips host/port/password/username for serverless types", () => {
    const conn = buildConnection({
      ...INITIAL_STATE,
      database: ":memory:",
      host: "ignored",
      name: "Local",
      password: "secret",
      type: "duckdb",
      username: "ignored",
    });
    expect(conn.host).toBe("");
    expect(conn.port).toBe(0);
    expect(conn.password).toBe("");
    expect(conn.username).toBe("");
  });

  it("preserves trust-server-certificate only for mssql", () => {
    const mssql = buildConnection({
      ...INITIAL_STATE,
      database: "app",
      name: "x",
      trustServerCertificate: false,
      type: "mssql",
    });
    expect(mssql.trustServerCertificate).toBeFalsy();

    const pg = buildConnection({
      ...INITIAL_STATE,
      database: "app",
      name: "x",
    });
    expect(pg.trustServerCertificate).toBeUndefined();
  });

  it("includes mongodb authSource only when set", () => {
    const without = buildConnection({
      ...INITIAL_STATE,
      authSource: "  ",
      database: "app",
      name: "x",
      type: "mongodb",
    });
    expect(without.authSource).toBeUndefined();

    const withSource = buildConnection({
      ...INITIAL_STATE,
      authSource: "admin",
      database: "app",
      name: "x",
      type: "mongodb",
    });
    expect(withSource.authSource).toBe("admin");
  });

  it("populates customPiiPatterns when redaction is effective", () => {
    const conn = buildConnection({
      ...INITIAL_STATE,
      customPiiPatterns: "email_\\d+\n# comment\nphone",
      database: "app",
      environment: "prod",
      name: "x",
    });
    expect(conn.customPiiPatterns).toStrictEqual(["email_\\d+", "phone"]);
  });

  it("drops customPiiPatterns when redaction is off", () => {
    const conn = buildConnection({
      ...INITIAL_STATE,
      customPiiPatterns: "email_\\d+",
      database: "app",
      name: "x",
      piiRedaction: false,
    });
    expect(conn.customPiiPatterns).toBeUndefined();
  });
});

describe("buildConnectionParams", () => {
  it("only carries connection-relevant fields", () => {
    const params = buildConnectionParams({
      ...INITIAL_STATE,
      database: "app",
      host: "db.local",
      name: "x",
      password: "p",
      port: "5433",
      username: "u",
    });
    expect(params).toStrictEqual({
      authSource: undefined,
      database: "app",
      host: "db.local",
      password: "p",
      port: 5433,
      trustServerCertificate: undefined,
      type: "postgresql",
      username: "u",
    });
  });
});

describe("getErrorMessage", () => {
  it("reads message from Error instances", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("reads message from message-bearing objects", () => {
    expect(getErrorMessage({ message: "nope" })).toBe("nope");
  });

  it("falls back for unknown values", () => {
    expect(getErrorMessage(null)).toBe("Connection failed");
    expect(getErrorMessage(42)).toBe("Connection failed");
  });
});

describe("type-driven label helpers", () => {
  it("getDatabaseLabel covers file-path, index and default", () => {
    expect(getDatabaseLabel("sqlite")).toBe("File path");
    expect(getDatabaseLabel("duckdb")).toBe("File path");
    expect(getDatabaseLabel("redis")).toBe("Database index");
    expect(getDatabaseLabel("postgresql")).toBe("Database");
  });

  it("getDatabaseHint returns guidance only for redis and duckdb", () => {
    expect(getDatabaseHint("redis")).toContain("0–15");
    expect(getDatabaseHint("duckdb")).toContain(":memory:");
    expect(getDatabaseHint("postgresql")).toBeNull();
  });

  it("getUsernamePlaceholder maps each type", () => {
    expect(getUsernamePlaceholder("mongodb")).toBe("");
    expect(getUsernamePlaceholder("clickhouse")).toBe("default");
    expect(getUsernamePlaceholder("mssql")).toBe("sa");
    expect(getUsernamePlaceholder("postgresql")).toBe("postgres");
  });

  it("getDatabasePlaceholder maps each type", () => {
    expect(getDatabasePlaceholder("sqlite")).toBe("/path/to/database.db");
    expect(getDatabasePlaceholder("duckdb")).toContain(":memory:");
    expect(getDatabasePlaceholder("redis")).toBe("0");
    expect(getDatabasePlaceholder("postgresql")).toBe("my_database");
  });
});
