import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { Checkbox } from "./checkbox";
import { Label } from "./label";

describe("checkbox", () => {
  it("default", async () => {
    const onCheckedChange = vi.fn();
    const screen = render(<Checkbox onCheckedChange={onCheckedChange} />);
    const checkbox = screen.getByRole("checkbox");
    await expect.element(checkbox).toBeVisible();
    await expect.element(checkbox).not.toBeChecked();
    await checkbox.click();
    expect(onCheckedChange).toHaveBeenCalledOnce();
    await expect.element(checkbox).toMatchScreenshot();
  });

  it("checked", async () => {
    const onCheckedChange = vi.fn();
    const screen = render(
      <Checkbox defaultChecked onCheckedChange={onCheckedChange} />
    );
    const checkbox = screen.getByRole("checkbox");
    await expect.element(checkbox).toBeChecked();
    await expect.element(checkbox).toMatchScreenshot();
  });

  it("withLabel", async () => {
    const onCheckedChange = vi.fn();
    const screen = render(
      <Label>
        <Checkbox onCheckedChange={onCheckedChange} />
        Remember me
      </Label>
    );
    const checkbox = screen.getByRole("checkbox");
    await expect.element(checkbox).not.toBeChecked();
    const label = screen.getByText("Remember me");
    await label.click();
    expect(onCheckedChange).toHaveBeenCalledOnce();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("disabled", async () => {
    const onCheckedChange = vi.fn();
    const screen = render(
      <Checkbox disabled onCheckedChange={onCheckedChange} />
    );
    const checkbox = screen.getByRole("checkbox");
    await expect.element(checkbox).toHaveAttribute("aria-disabled", "true");
    await expect.element(checkbox).toMatchScreenshot();
  });

  it("disabledChecked", async () => {
    const onCheckedChange = vi.fn();
    const screen = render(
      <Checkbox defaultChecked disabled onCheckedChange={onCheckedChange} />
    );
    const checkbox = screen.getByRole("checkbox");
    await expect.element(checkbox).toHaveAttribute("aria-disabled", "true");
    await expect.element(checkbox).toBeChecked();
    await expect.element(checkbox).toMatchScreenshot();
  });
});
