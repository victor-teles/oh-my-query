import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { Popover } from "@/components/ui/popover";

import { CellDetailPopover } from "./cell-detail-popover";

const renderPopover = (
  props: Partial<React.ComponentProps<typeof CellDetailPopover>> = {}
) =>
  render(
    <Popover open>
      <CellDetailPopover
        columnName={props.columnName ?? "name"}
        columnType={props.columnType ?? "text"}
        onOpenFullDetail={props.onOpenFullDetail ?? vi.fn()}
        value={"value" in props ? props.value : "hello"}
      />
    </Popover>
  );

describe("cell-detail-popover", () => {
  it("renders the column header and a string value", () => {
    const screen = renderPopover({ columnName: "email", value: "a@b.io" });

    expect(screen.getByText("email")).toBeInTheDocument();
    expect(screen.getByText("a@b.io")).toBeInTheDocument();
  });

  it("formats objects as pretty JSON", () => {
    const screen = renderPopover({ value: { active: true, id: 1 } });

    expect(screen.getByText(/"id":\s*1/, { exact: false })).toBeInTheDocument();
  });

  it("renders NULL and disables Copy when the value is null", () => {
    const screen = renderPopover({ value: null });

    const nulls = screen.getByText("NULL").all();
    expect(nulls.length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByRole("button", { name: /copy value/i }).element()
    ).toBeDisabled();
  });

  it("calls onOpenFullDetail from the Expand action", async () => {
    const onOpenFullDetail = vi.fn();
    const screen = renderPopover({ onOpenFullDetail });

    await screen.getByRole("button", { name: /open full detail/i }).click();

    expect(onOpenFullDetail).toHaveBeenCalledOnce();
  });

  it("writes the formatted value to clipboard on Copy", async () => {
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();

    try {
      const screen = renderPopover({ value: "abc" });
      await screen.getByRole("button", { name: /copy value/i }).click();
      expect(writeText).toHaveBeenCalledExactlyOnceWith("abc");
    } finally {
      writeText.mockRestore();
    }
  });
});
