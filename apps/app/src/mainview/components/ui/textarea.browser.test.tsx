import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { Label } from "./label";
import { Textarea } from "./textarea";

describe("textarea", () => {
  it("default", async () => {
    const screen = render(<Textarea placeholder="Type your message..." />);
    const textarea = screen.getByPlaceholder("Type your message...");
    await expect.element(textarea).toBeVisible();
    await textarea.click();
    await expect.element(textarea).toHaveFocus();
    await textarea.fill("SELECT * FROM users;");
    await expect.element(textarea).toHaveValue("SELECT * FROM users;");
    await expect.element(textarea).toMatchScreenshot();
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
    await expect.element(textarea).toHaveFocus();
    await textarea.fill("A multi-line\ntext input");
    await expect.element(textarea).toHaveValue("A multi-line\ntext input");
    await expect.element(screen.container).toMatchScreenshot();
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
    await expect.element(textarea).toBeDisabled();
    await expect.element(textarea).toMatchScreenshot();
  });

  it("invalid", async () => {
    const screen = render(
      <Textarea
        aria-invalid
        defaultValue="Invalid content"
        placeholder="Type your message..."
      />
    );
    const textarea = screen.getByPlaceholder("Type your message...");
    await expect.element(textarea).toHaveAttribute("aria-invalid", "true");
    await expect.element(textarea).toMatchScreenshot();
  });
});
