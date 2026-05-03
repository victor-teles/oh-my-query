import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { ResultsGridCell } from "./results-grid-cell";

const baseProps: React.ComponentProps<typeof ResultsGridCell> = {
  columnIndex: 0,
  columnName: "name",
  columnType: "text",
  isActive: false,
  isFirstRightPin: false,
  isLastLeftPin: false,
  onActivate: vi.fn(),
  onExpand: vi.fn(),
  pinOffset: 0,
  pinned: false,
  rowIndex: 0,
  value: "alpha",
  width: 200,
};

describe("results-grid-cell", () => {
  it("renders the formatted value with role gridcell", () => {
    const screen = render(<ResultsGridCell {...baseProps} />);

    const cell = screen.getByRole("gridcell").element();
    expect(cell).toHaveAttribute("aria-colindex", "1");
    expect(cell.textContent).toContain("alpha");
  });

  it("renders NULL in italic for null values", () => {
    const screen = render(<ResultsGridCell {...baseProps} value={null} />);

    expect(screen.getByText("NULL")).toBeInTheDocument();
  });

  it("right-aligns numeric values via the justify-end class", () => {
    const screen = render(<ResultsGridCell {...baseProps} value={42} />);

    expect(screen.getByRole("gridcell").element().className).toContain(
      "justify-end"
    );
  });

  it("does not right-align string values", () => {
    const screen = render(<ResultsGridCell {...baseProps} value="abc" />);

    expect(screen.getByRole("gridcell").element().className).not.toContain(
      "justify-end"
    );
  });

  it("activates the cell on double-click and opens the popover for short values", async () => {
    const onActivate = vi.fn();
    const onExpand = vi.fn();
    const screen = render(
      <ResultsGridCell
        {...baseProps}
        onActivate={onActivate}
        onExpand={onExpand}
        value="hi"
      />
    );

    await screen.getByRole("gridcell").dblClick();

    expect(onActivate).toHaveBeenCalledOnce();
    expect(onExpand).not.toHaveBeenCalled();
  });

  it("opens the expand dialog directly for very large values", async () => {
    const onActivate = vi.fn();
    const onExpand = vi.fn();
    const huge = "x".repeat(6000);
    const screen = render(
      <ResultsGridCell
        {...baseProps}
        onActivate={onActivate}
        onExpand={onExpand}
        value={huge}
      />
    );

    await screen.getByRole("gridcell").dblClick();

    expect(onActivate).toHaveBeenCalledOnce();
    expect(onExpand).toHaveBeenCalledExactlyOnceWith({
      column: "name",
      value: huge,
    });
  });

  it("applies sticky positioning when pinned left", () => {
    const screen = render(
      <ResultsGridCell
        {...baseProps}
        isLastLeftPin
        pinOffset={120}
        pinned="left"
      />
    );

    const cell = screen.getByRole("gridcell").element();
    expect(cell).toHaveAttribute("data-pinned", "left");
    expect(cell).toHaveAttribute("data-last-left-pin", "");
    expect((cell as HTMLElement).style.position).toBe("sticky");
    expect((cell as HTMLElement).style.left).toBe("120px");
  });
});
