import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { SyntaxTreeToggle } from "./syntax-tree-toggle";

describe("syntax-tree-toggle", () => {
  it('shows the "open" label when closed', () => {
    const screen = render(
      <SyntaxTreeToggle isOpen={false} onToggle={vi.fn()} />
    );
    expect(
      screen.getByRole("button", { name: "Open Syntax Tree" })
    ).toBeVisible();
  });

  it('shows the "close" label when open', () => {
    const screen = render(<SyntaxTreeToggle isOpen onToggle={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Close Syntax Tree" })
    ).toBeVisible();
  });

  it("invokes onToggle when clicked", async () => {
    const onToggle = vi.fn();
    const screen = render(
      <SyntaxTreeToggle isOpen={false} onToggle={onToggle} />
    );
    await screen.getByRole("button", { name: "Open Syntax Tree" }).click();
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
