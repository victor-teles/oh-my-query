import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { Checkbox } from "./checkbox";
import { Input } from "./input";
import { Label } from "./label";

describe("label", () => {
  it("default", async () => {
    const screen = render(<Label>Email address</Label>);
    const label = screen.getByText("Email address");
    await expect.element(label).toBeVisible();
    expect(label.element().tagName).toBe("LABEL");
    await expect.element(label).toMatchScreenshot();
  });

  it("withCheckbox", async () => {
    const screen = render(
      <Label>
        <Checkbox />
        Accept terms and conditions
      </Label>
    );
    const checkbox = screen.getByRole("checkbox");
    await expect.element(checkbox).not.toBeChecked();
    const label = screen.getByText("Accept terms and conditions");
    await label.click();
    await expect.element(checkbox).toBeChecked();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("withInput", async () => {
    const screen = render(
      <div className="grid gap-1.5">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" placeholder="John Doe" />
      </div>
    );
    const input = screen.getByLabelText("Full name");
    await expect.element(input).toBeVisible();
    await screen.getByText("Full name").click();
    await expect.element(input).toHaveFocus();
    await expect.element(screen.container).toMatchScreenshot();
  });
});
