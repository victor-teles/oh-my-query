import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { TabularResult } from "@/lib/tauri";

import { EditorInsertProvider } from "@/contexts/editor-insert-context";

import { ResultsGrid } from "./results-grid";

const makeResult = (
  columns: { name: string; typeName: string }[],
  rows: unknown[][],
  overrides: Partial<TabularResult> = {}
): TabularResult => ({
  columns,
  executionTimeMs: 0,
  isTruncated: false,
  resultType: "tabular",
  rowCount: rows.length,
  rows,
  ...overrides,
});

const renderGrid = (
  props: Partial<React.ComponentProps<typeof ResultsGrid>> = {}
) =>
  render(
    <EditorInsertProvider>
      <div style={{ height: 400, width: 800 }}>
        <ResultsGrid
          executedSql={props.executedSql ?? "SELECT 1"}
          onLoadMore={props.onLoadMore}
          result={
            props.result ??
            makeResult(
              [
                { name: "id", typeName: "int" },
                { name: "name", typeName: "text" },
              ],
              [
                [1, "alpha"],
                [2, "beta"],
              ]
            )
          }
        />
      </div>
    </EditorInsertProvider>
  );

describe("results-grid", () => {
  it("renders the empty state when there are no rows", () => {
    const screen = renderGrid({
      result: makeResult([{ name: "id", typeName: "int" }], []),
    });

    expect(screen.getByText(/no rows/i)).toBeInTheDocument();
    expect(screen.getByText(/0/)).toBeInTheDocument();
  });

  it("renders headers, body cells, and the row count footer", async () => {
    const screen = renderGrid();

    expect(
      screen.getByRole("columnheader", { name: /id/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /name/i })
    ).toBeInTheDocument();
    await expect.element(screen.getByText("alpha")).toBeInTheDocument();
    await expect.element(screen.getByText("beta")).toBeInTheDocument();
    expect(screen.getByText("rows")).toBeInTheDocument();
  });

  it("reorders rows when the column header sort is toggled", async () => {
    const screen = renderGrid({
      result: makeResult(
        [{ name: "label", typeName: "text" }],
        [["c"], ["a"], ["b"]]
      ),
    });

    const initial = screen
      .getByRole("gridcell")
      .all()
      .map((c) => c.element().textContent?.trim())
      .join(",");
    expect(initial).toBe("c,a,b");

    await screen.getByRole("button", { name: /sort by label/i }).click();

    const sorted = screen
      .getByRole("gridcell")
      .all()
      .map((c) => c.element().textContent?.trim())
      .join(",");
    expect(sorted).toBe("a,b,c");
  });

  it("forwards Load more clicks when the result is truncated", async () => {
    const onLoadMore = vi.fn();
    const screen = renderGrid({
      onLoadMore,
      result: makeResult([{ name: "id", typeName: "int" }], [[1]], {
        isTruncated: true,
        rowCount: 100,
      }),
    });

    await screen.getByRole("button", { name: /load 100 more/i }).click();
    expect(onLoadMore).toHaveBeenCalledExactlyOnceWith(200);
  });
});
