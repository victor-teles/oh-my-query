import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { TabularResult } from "@/lib/tauri";

import { ResultsGridFooter } from "./results-grid-footer";

const baseResult: TabularResult = {
  columns: [{ name: "id", typeName: "int" }],
  executionTimeMs: 0,
  isTruncated: false,
  resultType: "tabular",
  rowCount: 5,
  rows: [],
};

describe("results-grid-footer", () => {
  it("formats row count and pluralizes", () => {
    const screen = render(
      <ResultsGridFooter result={baseResult} selectedCount={0} />
    );

    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("rows")).toBeInTheDocument();
    expect(screen.container).toMatchSnapshot();
  });

  it("uses singular row label for one row", () => {
    const screen = render(
      <ResultsGridFooter
        result={{ ...baseResult, rowCount: 1 }}
        selectedCount={0}
      />
    );

    expect(screen.getByText("row")).toBeInTheDocument();
  });

  it("hides load-more when not truncated", () => {
    const screen = render(
      <ResultsGridFooter
        onLoadMore={vi.fn()}
        result={baseResult}
        selectedCount={0}
      />
    );

    expect(screen.getByText("(truncated)").query()).toBeNull();
    expect(screen.getByRole("button").query()).toBeNull();
  });

  it("renders load-more when truncated and doubles row count on click", async () => {
    const onLoadMore = vi.fn();
    const screen = render(
      <ResultsGridFooter
        onLoadMore={onLoadMore}
        result={{ ...baseResult, isTruncated: true, rowCount: 1000 }}
        selectedCount={0}
      />
    );

    expect(screen.getByText("(truncated)")).toBeInTheDocument();
    await screen.getByRole("button", { name: /load 1,000 more/i }).click();

    expect(onLoadMore).toHaveBeenCalledExactlyOnceWith(2000);
  });

  it("renders the selected count badge", () => {
    const screen = render(
      <ResultsGridFooter result={baseResult} selectedCount={3} />
    );

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("selected")).toBeInTheDocument();
  });

  it("hides truncation hint when not truncated even if onLoadMore is set", () => {
    const screen = render(
      <ResultsGridFooter
        onLoadMore={vi.fn()}
        result={baseResult}
        selectedCount={0}
      />
    );

    expect(screen.getByText("(truncated)").query()).toBeNull();
  });
});
