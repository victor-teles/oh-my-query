import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { Kbd, KbdGroup } from "./kbd";

describe("kbd", () => {
  it("default", async () => {
    const screen = render(<Kbd>⌘</Kbd>);
    const kbd = screen.getByText("⌘");
    await expect.element(kbd).toBeVisible();
    expect(kbd.element().tagName).toBe("KBD");
    await expect.element(kbd).toMatchScreenshot();
  });

  it("withText", async () => {
    const screen = render(<Kbd>Enter</Kbd>);
    await expect.element(screen.getByText("Enter")).toBeVisible();
    await expect.element(screen.getByText("Enter")).toMatchScreenshot();
  });

  it("group", async () => {
    const screen = render(
      <KbdGroup>
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>
    );
    await expect.element(screen.getByText("⌘")).toBeVisible();
    await expect.element(screen.getByText("K")).toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
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
    await expect.element(screen.getByText("Save")).toBeVisible();
    await expect.element(screen.getByText("Run query")).toBeVisible();
    await expect.element(screen.getByText("Command palette")).toBeVisible();
    await expect.element(screen.getByText("S")).toBeVisible();
    await expect.element(screen.getByText("↵")).toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });
});
