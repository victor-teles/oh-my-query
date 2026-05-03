import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { Label } from "./label";
import { Textarea } from "./textarea";

describe("textarea", () => {
  it("default", async () => {
    const screen = render(<Textarea placeholder="Type your message..." />);
    const textarea = screen.getByPlaceholder("Type your message...");
    expect(textarea).toBeVisible();
    await textarea.click();
    expect(textarea).toHaveFocus();
    await textarea.fill("SELECT * FROM users;");
    await expect(textarea).toHaveValue("SELECT * FROM users;");
    expect(textarea.element()).toMatchSnapshot();
  });

  it("withLabel", async () => {
    const screen = render(
      <div className="grid gap-1.5">
        <Label htmlFor="message">Message</Label>
        <Textarea id="message" placeholder="Type your message..." />
      </div>
    );
    const textarea = screen.getByLabelText("Message");
    await textarea.click();
    expect(textarea).toHaveFocus();
    await textarea.fill("A multi-line\ntext input");
    expect(textarea).toHaveValue("A multi-line\ntext input");
    expect(screen.container).toMatchSnapshot();
  });

  it("disabled", async () => {
    const screen = render(
      <Textarea
        defaultValue="Cannot edit this"
        disabled
        placeholder="Type your message..."
      />
    );
    const textarea = screen.getByPlaceholder("Type your message...");
    expect(textarea).toBeDisabled();
    await expect(textarea.element()).toMatchSnapshot();
  });

  it("invalid", () => {
    const screen = render(
      <Textarea
        aria-invalid
        defaultValue="Invalid content"
        placeholder="Type your message..."
      />
    );
    const textarea = screen.getByPlaceholder("Type your message...");
    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(textarea.element()).toMatchSnapshot();
  });

  it("applies desktop-friendly defaults", () => {
    const screen = render(<Textarea />);
    const textarea = screen.container.querySelector("textarea");
    expect(textarea).not.toBeNull();
    expect(textarea?.getAttribute("autocomplete")).toBe("off");
    expect(textarea?.getAttribute("autocorrect")).toBe("off");
    expect(textarea?.getAttribute("autocapitalize")).toBe("off");
    expect(textarea?.getAttribute("spellcheck")).toBe("false");
  });

  it("lets consumers re-enable spellcheck for prose fields", () => {
    const screen = render(<Textarea spellCheck />);
    const textarea = screen.container.querySelector("textarea");
    expect(textarea?.getAttribute("spellcheck")).toBe("true");
  });
});
