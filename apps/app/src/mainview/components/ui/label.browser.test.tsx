import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { Checkbox } from "./checkbox";
import { Input } from "./input";
import { Label } from "./label";

describe("label", () => {
  it("default", () => {
    const screen = render(<Label>Email address</Label>);
    const label = screen.getByText("Email address");
    expect(label).toBeVisible();
    expect(label.element().tagName).toBe("LABEL");
    expect(label.element()).toMatchSnapshot();
  });

  it("withCheckbox", async () => {
    const screen = render(
      <Label>
        <Checkbox />
        Accept terms and conditions
      </Label>
    );
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
    const label = screen.getByText("Accept terms and conditions");
    await label.click();
    await expect(checkbox).toBeChecked();
    expect(screen.container).toMatchSnapshot();
  });

  it("withInput", async () => {
    const screen = render(
      <div className="grid gap-1.5">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" placeholder="John Doe" />
      </div>
    );
    const input = screen.getByLabelText("Full name");
    expect(input).toBeVisible();
    await screen.getByText("Full name").click();
    await expect(input).toHaveFocus();
    expect(screen.container).toMatchSnapshot();
  });
});
