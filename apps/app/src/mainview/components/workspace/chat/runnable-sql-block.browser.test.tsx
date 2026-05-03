import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { ExecuteResult } from "@/lib/tauri";

import { mockTauri } from "@/test/tauri-mock";

import { isReadOnlySql, RunnableSqlBlock } from "./runnable-sql-block";

vi.mock(import("./highlighted-sql"), () => ({
  HighlightedSql: ({ code }: { code: string }) => (
    <pre data-testid="sql">{code}</pre>
  ),
}));

const fakeResult: ExecuteResult = {
  columns: [{ name: "n", typeName: "int" }],
  executionTimeMs: 5,
  isTruncated: false,
  resultType: "tabular",
  rowCount: 1,
  rows: [[1]],
};

describe("isReadOnlySql", () => {
  it.each([
    "SELECT 1",
    "select * from users",
    "  WITH cte AS (SELECT 1) SELECT * FROM cte",
    "SHOW TABLES",
    "EXPLAIN SELECT 1",
    "DESCRIBE users",
    "DESC users",
  ])("recognizes read-only: %s", (sql) => {
    expect(isReadOnlySql(sql)).toBeTruthy();
  });

  it.each([
    "INSERT INTO t VALUES (1)",
    "UPDATE t SET a = 1",
    "DELETE FROM t",
    "DROP TABLE t",
    "ALTER TABLE t ADD COLUMN c int",
    "TRUNCATE TABLE t",
    "CREATE TABLE t(a int)",
    "GRANT SELECT ON t TO u",
    "VACUUM ANALYZE t",
  ])("rejects mutating: %s", (sql) => {
    expect(isReadOnlySql(sql)).toBeFalsy();
  });

  it("rejects multi-statement queries", () => {
    expect(isReadOnlySql("SELECT 1; SELECT 2")).toBeFalsy();
  });

  it("ignores keywords inside strings and comments", () => {
    expect(isReadOnlySql("SELECT 'DROP TABLE users' -- DELETE")).toBeTruthy();
    expect(isReadOnlySql("SELECT /* DELETE */ 1")).toBeTruthy();
  });

  it("rejects mixed read+write where the leading is read-only but body mutates", () => {
    expect(isReadOnlySql("SELECT case when 1=1 then UPDATE end")).toBeFalsy();
  });
});

describe("runnableSqlBlock", () => {
  it("auto-runs read-only SQL when autoRun is true", async () => {
    const executeQuery = vi.fn(() => fakeResult);
    mockTauri({ executeQuery });

    const screen = render(
      <RunnableSqlBlock autoRun code="SELECT 1" connectionId="conn-1" />
    );

    await expect
      .poll(() => executeQuery.mock.calls.length)
      .toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("sql").element().textContent).toBe("SELECT 1");
  });

  it("does not auto-run mutating SQL", async () => {
    const executeQuery = vi.fn(() => fakeResult);
    mockTauri({ executeQuery });

    render(
      <RunnableSqlBlock
        autoRun
        code="DELETE FROM users"
        connectionId="conn-1"
      />
    );

    await vi.waitFor(() => {
      expect(executeQuery).not.toHaveBeenCalled();
    });
  });

  it("renders an inline result after a successful manual run", async () => {
    const executeQuery = vi.fn(() => fakeResult);
    mockTauri({ executeQuery });

    const screen = render(
      <RunnableSqlBlock code="SELECT 1" connectionId="conn-1" />
    );

    await screen.getByRole("button", { name: /run query/i }).click();

    await expect.element(screen.getByText(/^1 row/)).toBeInTheDocument();
  });

  it("surfaces an error message after a failed run", async () => {
    mockTauri({
      executeQuery: () => {
        throw new Error("ECONNREFUSED");
      },
    });

    const screen = render(
      <RunnableSqlBlock code="SELECT 1" connectionId="conn-1" />
    );

    await screen.getByRole("button", { name: /run query/i }).click();

    await expect.element(screen.getByText("ECONNREFUSED")).toBeInTheDocument();
  });
});
