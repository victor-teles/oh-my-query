import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { Input } from "./input";
import { Label } from "./label";

describe("input", () => {
  it("default", async () => {
    const screen = render(<Input placeholder="Type something..." />);
    const input = screen.getByPlaceholder("Type something...");
    await expect.element(input).toBeVisible();
    await input.click();
    await expect.element(input).toHaveFocus();
    await input.fill("Hello world");
    await expect.element(input).toHaveValue("Hello world");
    await expect.element(input).toMatchScreenshot();
  });

  it("withLabel", async () => {
    const screen = render(
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" placeholder="you@example.com" type="email" />
      </div>
    );
    const label = screen.getByText("Email");
    await expect.element(label).toBeVisible();
    const input = screen.getByLabelText("Email");
    await input.click();
    await expect.element(input).toHaveFocus();
    await input.fill("user@test.com");
    await expect.element(input).toHaveValue("user@test.com");
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("password", async () => {
    const screen = render(
      <Input placeholder="Enter password" type="password" />
    );
    const input = screen.getByPlaceholder("Enter password");
    await input.fill("secret123");
    await expect.element(input).toHaveValue("secret123");
    await expect.element(input).toHaveAttribute("type", "password");
    await expect.element(input).toMatchScreenshot();
  });

  it("disabled", async () => {
    const screen = render(
      <Input
        defaultValue="Disabled input"
        disabled
        placeholder="Type something..."
      />
    );
    const input = screen.getByPlaceholder("Type something...");
    await expect.element(input).toBeDisabled();
    await expect.element(input).toMatchScreenshot();
  });

  it("invalid", async () => {
    const screen = render(
      <Input
        aria-invalid
        defaultValue="Bad value"
        placeholder="Type something..."
      />
    );
    const input = screen.getByPlaceholder("Type something...");
    await expect.element(input).toHaveAttribute("aria-invalid", "true");
    await expect.element(input).toMatchScreenshot();
  });

  it("file", async () => {
    const screen = render(<Input type="file" />);
    const input = screen.container.querySelector("input[type='file']");
    expect(input).toBeTruthy();
    await expect.element(screen.container).toMatchScreenshot();
  });
});
