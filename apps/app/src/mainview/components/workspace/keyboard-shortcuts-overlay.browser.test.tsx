import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { KeyboardShortcutsOverlay } from "./keyboard-shortcuts-overlay";

describe("keyboard-shortcuts-overlay", () => {
  it("does not render content when closed", () => {
    const screen = render(
      <KeyboardShortcutsOverlay onOpenChange={vi.fn()} open={false} />
    );
    expect(
      screen.getByRole("heading", { name: "Keyboard shortcuts" }).query()
    ).toBeNull();
  });

  it("lists all section headings when open", () => {
    const screen = render(
      <KeyboardShortcutsOverlay onOpenChange={vi.fn()} open />
    );
    expect(
      screen.getByRole("heading", { name: "Keyboard shortcuts" })
    ).toBeVisible();
    for (const heading of ["Query", "Tabs", "Layout", "Schema", "Help"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeVisible();
    }
  });
});
