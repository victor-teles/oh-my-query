import type { Column } from "@tanstack/react-table";

import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { useResultsColumns } from "./-hooks/use-results-columns";
import {
  ResultsColumnHeaderMenu,
  ResultsColumnHeaderTrigger,
} from "./results-column-header-menu";

interface HarnessProps {
  onFitColumn: (id: string) => void;
  onFitAllColumns: () => void;
  variant: "trigger" | "menu";
}

const Harness = ({ onFitColumn, onFitAllColumns, variant }: HarnessProps) => {
  const columns = useResultsColumns([
    { name: "id", typeName: "int" },
    { name: "name", typeName: "text" },
  ]);
  const table = useReactTable({
    columns,
    data: [
      [1, "alpha"],
      [2, "beta"],
    ],
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const column = table.getColumn("id") as Column<unknown[], unknown>;

  if (variant === "menu") {
    return (
      <ResultsColumnHeaderMenu
        column={column}
        onFitAllColumns={onFitAllColumns}
        onFitColumn={onFitColumn}
      >
        <button type="button">Header</button>
      </ResultsColumnHeaderMenu>
    );
  }
  return (
    <ResultsColumnHeaderTrigger
      column={column}
      onFitAllColumns={onFitAllColumns}
      onFitColumn={onFitColumn}
    />
  );
};

describe("results-column-header-menu (dropdown trigger)", () => {
  it("renders an aria-labelled trigger button", () => {
    const screen = render(
      <Harness
        onFitAllColumns={vi.fn()}
        onFitColumn={vi.fn()}
        variant="trigger"
      />
    );

    expect(
      screen.getByRole("button", { name: /column menu for id/i })
    ).toBeInTheDocument();
  });

  it("opens a menu with sort, pin, and fit actions", async () => {
    const screen = render(
      <Harness
        onFitAllColumns={vi.fn()}
        onFitColumn={vi.fn()}
        variant="trigger"
      />
    );

    await screen.getByRole("button", { name: /column menu for id/i }).click();

    expect(
      screen.getByRole("menuitem", { name: /sort ascending/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /sort descending/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /pin left/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /fit column/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /fit all columns/i })
    ).toBeInTheDocument();
  });

  it("calls onFitColumn with the column id when Fit column is clicked", async () => {
    const onFitColumn = vi.fn();
    const screen = render(
      <Harness
        onFitAllColumns={vi.fn()}
        onFitColumn={onFitColumn}
        variant="trigger"
      />
    );

    await screen.getByRole("button", { name: /column menu for id/i }).click();
    await screen.getByRole("menuitem", { name: /fit column/i }).click();

    expect(onFitColumn).toHaveBeenCalledExactlyOnceWith("id");
  });

  it("calls onFitAllColumns from the Fit all columns item", async () => {
    const onFitAllColumns = vi.fn();
    const screen = render(
      <Harness
        onFitAllColumns={onFitAllColumns}
        onFitColumn={vi.fn()}
        variant="trigger"
      />
    );

    await screen.getByRole("button", { name: /column menu for id/i }).click();
    await screen.getByRole("menuitem", { name: /fit all columns/i }).click();

    expect(onFitAllColumns).toHaveBeenCalledOnce();
  });
});
