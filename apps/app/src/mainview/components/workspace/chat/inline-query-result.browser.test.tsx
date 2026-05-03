import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import type { ExecuteResult } from "@/lib/tauri";

import {
  InlineQueryResult,
  InlineRunError,
  InlineRunningIndicator,
} from "./inline-query-result";

const tabular = (rows: unknown[][], overrides: Partial<ExecuteResult> = {}) =>
  ({
    columns: [
      { name: "id", typeName: "int" },
      { name: "name", typeName: "text" },
    ],
    executionTimeMs: 42,
    isTruncated: false,
    resultType: "tabular",
    rowCount: rows.length,
    rows,
    ...overrides,
  }) as ExecuteResult & { resultType: "tabular" };

describe("inline-query-result — tabular", () => {
  it("renders rows up to PREVIEW_ROW_COUNT and shows headers", () => {
    const screen = render(
      <InlineQueryResult
        result={tabular([
          [1, "alpha"],
          [2, "beta"],
        ])}
      />
    );

    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
    expect(screen.getByText("id")).toBeInTheDocument();
    expect(screen.getByText("name")).toBeInTheDocument();
    expect(screen.getByText(/2 rows/)).toBeInTheDocument();
  });

  it("uses singular row label when rowCount is 1", () => {
    const screen = render(
      <InlineQueryResult result={tabular([[1, "alpha"]])} />
    );
    expect(screen.getByText(/^1 row/)).toBeInTheDocument();
  });

  it("renders a remaining-rows hint past the preview cap", () => {
    const rows = Array.from({ length: 12 }, (_, i) => [i, `n${i}`]);
    const screen = render(<InlineQueryResult result={tabular(rows)} />);

    expect(screen.getByText(/\+2 more rows/)).toBeInTheDocument();
  });

  it("renders Truncated indicator", () => {
    const screen = render(
      <InlineQueryResult result={tabular([[1, "x"]], { isTruncated: true })} />
    );
    expect(screen.getByText("Truncated")).toBeInTheDocument();
  });

  it("displays an em-dash for null cell values", () => {
    const screen = render(<InlineQueryResult result={tabular([[1, null]])} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("formats execution times above one second in seconds", () => {
    const screen = render(
      <InlineQueryResult
        result={tabular([[1, "a"]], { executionTimeMs: 1500 })}
      />
    );
    expect(screen.getByText(/1\.50s/)).toBeInTheDocument();
  });
});

describe("inline-query-result — documents", () => {
  const docs = (documents: unknown[], overrides: Partial<ExecuteResult> = {}) =>
    ({
      count: documents.length,
      documents,
      executionTimeMs: 100,
      isTruncated: false,
      resultType: "documents",
      ...overrides,
    }) as ExecuteResult & { resultType: "documents" };

  it("renders documents as JSON", () => {
    const screen = render(
      <InlineQueryResult result={docs([{ a: 1 }, { b: 2 }])} />
    );
    expect(screen.getByText(/2 documents/)).toBeInTheDocument();
  });

  it("uses singular label when count is 1", () => {
    const screen = render(<InlineQueryResult result={docs([{ a: 1 }])} />);
    expect(screen.getByText(/^1 document/)).toBeInTheDocument();
  });
});

describe("inlineRunningIndicator", () => {
  it("renders the default label", () => {
    const screen = render(<InlineRunningIndicator />);
    expect(screen.getByText("Running…")).toBeInTheDocument();
  });

  it("accepts a custom label", () => {
    const screen = render(<InlineRunningIndicator label="Loading data…" />);
    expect(screen.getByText("Loading data…")).toBeInTheDocument();
  });
});

describe("inlineRunError", () => {
  it("renders the error message", () => {
    const screen = render(<InlineRunError error="ECONNREFUSED" />);
    expect(screen.getByText("ECONNREFUSED")).toBeInTheDocument();
  });
});
