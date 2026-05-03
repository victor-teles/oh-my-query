import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { Input } from "./input";
import { Label } from "./label";

describe("input", () => {
  it("default", async () => {
    const screen = render(<Input placeholder="Type something..." />);
    const input = screen.getByPlaceholder("Type something...");
    expect(input).toBeVisible();
    await input.click();
    expect(input).toHaveFocus();
    await input.fill("Hello world");
    await expect(input).toHaveValue("Hello world");
    expect(input.element()).toMatchSnapshot();
  });

  it("withLabel", async () => {
    const screen = render(
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" placeholder="you@example.com" type="email" />
      </div>
    );
    const label = screen.getByText("Email");
    expect(label).toBeVisible();
    const input = screen.getByLabelText("Email");
    await input.click();
    expect(input).toHaveFocus();
    await input.fill("user@test.com");
    await expect(input).toHaveValue("user@test.com");
    expect(screen.container).toMatchSnapshot();
  });

  it("password", async () => {
    const screen = render(
      <Input placeholder="Enter password" type="password" />
    );
    const input = screen.getByPlaceholder("Enter password");
    await input.fill("secret123");
    expect(input).toHaveValue("secret123");
    await expect(input).toHaveAttribute("type", "password");
    expect(input.element()).toMatchSnapshot();
  });

  it("disabled", () => {
    const screen = render(
      <Input
        defaultValue="Disabled input"
        disabled
        placeholder="Type something..."
      />
    );
    const input = screen.getByPlaceholder("Type something...");
    expect(input).toBeDisabled();
    expect(input.element()).toMatchSnapshot();
  });

  it("invalid", () => {
    const screen = render(
      <Input
        aria-invalid
        defaultValue="Bad value"
        placeholder="Type something..."
      />
    );
    const input = screen.getByPlaceholder("Type something...");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.element()).toMatchSnapshot();
  });

  it("file", () => {
    const screen = render(<Input type="file" />);
    const input = screen.container.querySelector("input[type='file']");
    expect(input).toBeTruthy();
    expect(screen.container).toMatchSnapshot();
  });

  it("disables browser autofill and spellcheck by default", () => {
    const screen = render(<Input />);
    const input = screen.container.querySelector("input");
    expect(input).not.toBeNull();
    expect(input?.getAttribute("autocomplete")).toBe("off");
    expect(input?.getAttribute("autocorrect")).toBe("off");
    expect(input?.getAttribute("autocapitalize")).toBe("off");
    expect(input?.getAttribute("spellcheck")).toBe("false");
  });

  it("hides itself from password managers by default", () => {
    const screen = render(<Input />);
    const input = screen.container.querySelector(
      "input"
    ) as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(input?.dataset["1pIgnore"]).toBe("true");
    expect(input?.dataset.lpignore).toBe("true");
    expect(input?.dataset.formType).toBe("other");
  });

  it("lets consumers override the autocomplete attribute", () => {
    const screen = render(<Input autoComplete="username" />);
    const input = screen.container.querySelector("input");
    expect(input?.getAttribute("autocomplete")).toBe("username");
  });

  it("lets consumers re-enable spellcheck", () => {
    const screen = render(<Input spellCheck />);
    const input = screen.container.querySelector("input");
    expect(input?.getAttribute("spellcheck")).toBe("true");
  });
});
