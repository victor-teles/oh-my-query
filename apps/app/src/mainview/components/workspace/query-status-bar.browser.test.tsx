import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { ExecuteResult } from "@/lib/tauri";

import { QueryStatusBar } from "./query-status-bar";

const tabular = (
  overrides: Partial<ExecuteResult & { resultType: "tabular" }> = {}
): ExecuteResult => ({
  columns: [{ name: "n", typeName: "int" }],
  executionTimeMs: 42,
  isTruncated: false,
  resultType: "tabular",
  rowCount: 5,
  rows: [],
  ...overrides,
});

const documents = (
  overrides: Partial<ExecuteResult & { resultType: "documents" }> = {}
): ExecuteResult => ({
  count: 3,
  documents: [],
  executionTimeMs: 21,
  isTruncated: false,
  resultType: "documents",
  ...overrides,
});

describe("query-status-bar", () => {
  it("renders row count and label for tabular results", () => {
    const screen = render(<QueryStatusBar result={tabular()} />);

    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("rows")).toBeInTheDocument();
  });

  it("uses singular row label when rowCount is 1", () => {
    const screen = render(<QueryStatusBar result={tabular({ rowCount: 1 })} />);
    expect(screen.getByText("row")).toBeInTheDocument();
  });

  it("renders document count and label for document results", () => {
    const screen = render(<QueryStatusBar result={documents()} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("documents")).toBeInTheDocument();
  });

  it("renders the truncation banner when isTruncated", () => {
    const screen = render(
      <QueryStatusBar result={tabular({ isTruncated: true })} />
    );
    expect(screen.getByText("Result truncated")).toBeInTheDocument();
  });

  it("renders the Query hover trigger only when executedSql is provided", () => {
    const screen = render(<QueryStatusBar result={tabular()} />);
    expect(screen.getByText("Query").query()).toBeNull();
  });

  it("renders the Query hover trigger when executedSql is non-empty", () => {
    const screen = render(
      <QueryStatusBar executedSql="SELECT 1" result={tabular()} />
    );
    expect(screen.getByText("Query")).toBeInTheDocument();
  });

  it("renders the download button when onDownloadCsv is provided", async () => {
    const onDownloadCsv = vi.fn();
    const screen = render(
      <QueryStatusBar onDownloadCsv={onDownloadCsv} result={tabular()} />
    );

    await screen.getByRole("button", { name: /download as csv/i }).click();
    expect(onDownloadCsv).toHaveBeenCalledOnce();
  });

  it("hides the download button when no callback", () => {
    const screen = render(<QueryStatusBar result={tabular()} />);
    expect(
      screen.getByRole("button", { name: /download as csv/i }).query()
    ).toBeNull();
  });
});
