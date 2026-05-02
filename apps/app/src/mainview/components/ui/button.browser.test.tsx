import { ArchiveIcon, PlusIcon, TrashIcon } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { Button } from "./button";

describe("button", () => {
  it("default", async () => {
    const onClick = vi.fn();
    const screen = render(<Button onClick={onClick}>Button</Button>);
    const btn = screen.getByRole("button", { name: "Button" });
    await expect.element(btn).toBeVisible();
    await btn.click();
    expect(onClick).toHaveBeenCalledOnce();
    await expect.element(btn).toMatchScreenshot();
  });

  it("secondary", async () => {
    const onClick = vi.fn();
    const screen = render(
      <Button onClick={onClick} variant="secondary">
        Button
      </Button>
    );
    const btn = screen.getByRole("button", { name: "Button" });
    await btn.click();
    expect(onClick).toHaveBeenCalledOnce();
    await expect.element(btn).toMatchScreenshot();
  });

  it("destructive", async () => {
    const onClick = vi.fn();
    const screen = render(
      <Button onClick={onClick} variant="destructive">
        Delete
      </Button>
    );
    const btn = screen.getByRole("button", { name: "Delete" });
    await btn.click();
    expect(onClick).toHaveBeenCalledOnce();
    await expect.element(btn).toMatchScreenshot();
  });

  it("ghost", async () => {
    const onClick = vi.fn();
    const screen = render(
      <Button onClick={onClick} variant="ghost">
        Button
      </Button>
    );
    const btn = screen.getByRole("button", { name: "Button" });
    await btn.click();
    expect(onClick).toHaveBeenCalledOnce();
    await expect.element(btn).toMatchScreenshot();
  });

  it("outline", async () => {
    const onClick = vi.fn();
    const screen = render(
      <Button onClick={onClick} variant="outline">
        Button
      </Button>
    );
    const btn = screen.getByRole("button", { name: "Button" });
    await btn.click();
    expect(onClick).toHaveBeenCalledOnce();
    await expect.element(btn).toMatchScreenshot();
  });

  it("link", async () => {
    const onClick = vi.fn();
    const screen = render(
      <Button onClick={onClick} variant="link">
        Button
      </Button>
    );
    const btn = screen.getByRole("button", { name: "Button" });
    await btn.click();
    expect(onClick).toHaveBeenCalledOnce();
    await expect.element(btn).toMatchScreenshot();
  });

  it("toolbar", async () => {
    const onClick = vi.fn();
    const screen = render(
      <Button onClick={onClick} variant="toolbar">
        Button
      </Button>
    );
    const btn = screen.getByRole("button", { name: "Button" });
    await btn.click();
    expect(onClick).toHaveBeenCalledOnce();
    await expect.element(btn).toMatchScreenshot();
  });

  it("small", async () => {
    const screen = render(<Button size="sm">Button</Button>);
    await expect
      .element(screen.getByRole("button", { name: "Button" }))
      .toMatchScreenshot();
  });

  it("extraSmall", async () => {
    const screen = render(<Button size="xs">Button</Button>);
    await expect
      .element(screen.getByRole("button", { name: "Button" }))
      .toMatchScreenshot();
  });

  it("large", async () => {
    const screen = render(<Button size="lg">Button</Button>);
    await expect
      .element(screen.getByRole("button", { name: "Button" }))
      .toMatchScreenshot();
  });

  it("icon", async () => {
    const onClick = vi.fn();
    const screen = render(
      <Button aria-label="Add" onClick={onClick} size="icon">
        <PlusIcon />
      </Button>
    );
    const btn = screen.getByRole("button", { name: "Add" });
    await btn.click();
    expect(onClick).toHaveBeenCalledOnce();
    await expect.element(btn).toMatchScreenshot();
  });

  it("iconSmall", async () => {
    const screen = render(
      <Button aria-label="Add" size="icon-sm">
        <PlusIcon />
      </Button>
    );
    await expect
      .element(screen.getByRole("button", { name: "Add" }))
      .toMatchScreenshot();
  });

  it("withIcon", async () => {
    const onClick = vi.fn();
    const screen = render(
      <Button onClick={onClick}>
        <ArchiveIcon data-icon="inline-start" />
        Archive
      </Button>
    );
    const btn = screen.getByRole("button", { name: "Archive" });
    await btn.click();
    expect(onClick).toHaveBeenCalledOnce();
    await expect.element(btn).toMatchScreenshot();
  });

  it("destructiveWithIcon", async () => {
    const screen = render(
      <Button variant="destructive">
        <TrashIcon data-icon="inline-start" />
        Delete
      </Button>
    );
    await expect
      .element(screen.getByRole("button", { name: "Delete" }))
      .toMatchScreenshot();
  });

  it("disabled", async () => {
    const screen = render(<Button disabled>Button</Button>);
    const btn = screen.getByRole("button", { name: "Button" });
    await expect.element(btn).toBeDisabled();
    await expect.element(btn).toMatchScreenshot();
  });

  it("allVariants", async () => {
    const screen = render(
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="default">Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="link">Link</Button>
        <Button variant="toolbar">Toolbar</Button>
      </div>
    );
    for (const name of [
      "Default",
      "Secondary",
      "Destructive",
      "Ghost",
      "Outline",
      "Link",
      "Toolbar",
    ]) {
      await expect.element(screen.getByRole("button", { name })).toBeVisible();
    }
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("allSizes", async () => {
    const screen = render(
      <div className="flex flex-wrap items-center gap-2">
        <Button size="xs">Extra Small</Button>
        <Button size="sm">Small</Button>
        <Button size="default">Default</Button>
        <Button size="lg">Large</Button>
        <Button aria-label="Add" size="icon">
          <PlusIcon />
        </Button>
      </div>
    );
    await expect
      .element(screen.getByRole("button", { name: "Extra Small" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Large" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Add" }))
      .toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });
});
