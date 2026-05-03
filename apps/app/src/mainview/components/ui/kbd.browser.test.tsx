import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { Kbd, KbdGroup } from "./kbd";

describe("kbd", () => {
  it("default", () => {
    const screen = render(<Kbd>⌘</Kbd>);
    const kbd = screen.getByText("⌘");
    expect(kbd).toBeVisible();
    expect(kbd.element().tagName).toBe("KBD");
    expect(kbd.element()).toMatchSnapshot();
  });

  it("withText", () => {
    const screen = render(<Kbd>Enter</Kbd>);
    expect(screen.getByText("Enter")).toBeVisible();
    expect(screen.getByText("Enter").element()).toMatchSnapshot();
  });

  it("group", async () => {
    const screen = render(
      <KbdGroup>
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>
    );
    expect(screen.getByText("⌘")).toBeVisible();
    await expect(screen.getByText("K")).toBeVisible();
    expect(screen.container).toMatchSnapshot();
  });

  it("commonShortcuts", async () => {
    const screen = render(
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          Save
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>S</Kbd>
          </KbdGroup>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          Run query
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>↵</Kbd>
          </KbdGroup>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          Command palette
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </div>
      </div>
    );
    expect(screen.getByText("Save")).toBeVisible();
    await expect(screen.getByText("Run query")).toBeVisible();
    expect(screen.getByText("Command palette")).toBeVisible();
    await expect(screen.getByText("S")).toBeVisible();
    await expect.element(screen.getByText("↵")).toBeVisible();
    expect(screen.container).toMatchSnapshot();
  });
});
