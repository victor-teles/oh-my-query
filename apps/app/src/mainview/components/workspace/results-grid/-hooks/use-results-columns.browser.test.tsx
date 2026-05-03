import type { Row } from "@tanstack/react-table";

import { describe, expect, it } from "vitest";

import type { ColumnInfo } from "@/lib/tauri";

import { renderHook } from "@/test/render-hook";

import type { ResultsColumnMeta } from "./use-results-columns";

import { useResultsColumns } from "./use-results-columns";

const fakeRow = (values: unknown[]): Row<unknown[]> =>
  ({
    getValue: (id: string) => {
      const idx = Number(id.replace("col-", ""));
      return values[idx];
    },
  }) as unknown as Row<unknown[]>;

describe("useResultsColumns", () => {
  it("maps ColumnInfo[] to indexed ColumnDef[]", () => {
    const columns: ColumnInfo[] = [
      { name: "id", typeName: "int" },
      { name: "name", typeName: "text" },
    ];
    const { result } = renderHook(({ cols }) => useResultsColumns(cols), {
      initialProps: { cols: columns },
    });

    const [first, second] = result.current as [
      { id: string; header: string; meta: ResultsColumnMeta },
      { id: string; header: string; meta: ResultsColumnMeta },
    ];
    expect(result.current).toHaveLength(2);
    expect(first.id).toBe("id");
    expect(first.header).toBe("id");
    expect(first.meta.columnIndex).toBe(0);
    expect(second.meta.typeName).toBe("text");
  });

  it("memoizes the array between renders with the same columns", () => {
    const columns: ColumnInfo[] = [{ name: "a", typeName: "text" }];
    const { result, rerender } = renderHook(
      ({ cols }) => useResultsColumns(cols),
      { initialProps: { cols: columns } }
    );
    const first = result.current;

    rerender({ cols: columns });

    expect(result.current).toBe(first);
  });

  it("provides a sortingFn that compares by indexed value", () => {
    const columns: ColumnInfo[] = [{ name: "col-0", typeName: "int" }];
    const { result } = renderHook(({ cols }) => useResultsColumns(cols), {
      initialProps: { cols: columns },
    });

    const sortingFn = result.current[0]?.sortingFn as (
      a: Row<unknown[]>,
      b: Row<unknown[]>,
      id: string
    ) => number;

    expect(sortingFn(fakeRow([1]), fakeRow([2]), "col-0")).toBeLessThan(0);
    expect(sortingFn(fakeRow([2]), fakeRow([1]), "col-0")).toBeGreaterThan(0);
    expect(sortingFn(fakeRow([1]), fakeRow([1]), "col-0")).toBe(0);
  });
});
