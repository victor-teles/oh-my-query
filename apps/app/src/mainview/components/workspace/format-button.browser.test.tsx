import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { FormatButton } from "./format-button";

describe("format-button", () => {
  it("invokes onClick when enabled", async () => {
    const onClick = vi.fn();
    const screen = render(<FormatButton disabled={false} onClick={onClick} />);
    const btn = screen.getByRole("button", { name: "Format SQL" });
    await btn.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders disabled when disabled is true", () => {
    const screen = render(<FormatButton disabled onClick={vi.fn()} />);
    const btn = screen.getByRole("button", { name: "Format SQL" });
    expect(btn).toBeDisabled();
  });
});
