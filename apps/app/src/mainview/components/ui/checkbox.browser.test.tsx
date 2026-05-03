import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { Checkbox } from "./checkbox";
import { Label } from "./label";

describe("checkbox", () => {
  it("default", async () => {
    const onCheckedChange = vi.fn();
    const screen = render(<Checkbox onCheckedChange={onCheckedChange} />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeVisible();
    expect(checkbox).not.toBeChecked();
    await checkbox.click();
    expect(onCheckedChange).toHaveBeenCalledOnce();
    await expect(checkbox.element()).toMatchSnapshot();
  });

  it("checked", () => {
    const onCheckedChange = vi.fn();
    const screen = render(
      <Checkbox defaultChecked onCheckedChange={onCheckedChange} />
    );
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
    expect(checkbox.element()).toMatchSnapshot();
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
    expect(checkbox).not.toBeChecked();
    const label = screen.getByText("Remember me");
    await label.click();
    expect(onCheckedChange).toHaveBeenCalledOnce();
    expect(screen.container).toMatchSnapshot();
  });

  it("disabled", async () => {
    const onCheckedChange = vi.fn();
    const screen = render(
      <Checkbox disabled onCheckedChange={onCheckedChange} />
    );
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("aria-disabled", "true");
    await expect(checkbox.element()).toMatchSnapshot();
  });

  it("disabledChecked", async () => {
    const onCheckedChange = vi.fn();
    const screen = render(
      <Checkbox defaultChecked disabled onCheckedChange={onCheckedChange} />
    );
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("aria-disabled", "true");
    expect(checkbox).toBeChecked();
    await expect(checkbox.element()).toMatchSnapshot();
  });
});
