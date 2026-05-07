import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { CommandEditor } from "./command-editor";

describe("command-editor", () => {
  it("renders Redis-specific placeholder", () => {
    const screen = render(
      <CommandEditor
        databaseType="redis"
        onChange={vi.fn()}
        onExecute={vi.fn()}
        value=""
      />
    );
    const textarea = screen.getByRole("textbox");
    expect(textarea.element()).toHaveAttribute(
      "placeholder",
      expect.stringContaining("GET mykey")
    );
  });

  it("calls onChange when the textarea is edited", async () => {
    const onChange = vi.fn();
    const screen = render(
      <CommandEditor
        databaseType="redis"
        onChange={onChange}
        onExecute={vi.fn()}
        value=""
      />
    );
    await screen.getByRole("textbox").fill("PING");
    expect(onChange.mock.calls.at(-1)?.[0]).toBe("PING");
  });

  it("falls back to a generic placeholder for unknown database types", () => {
    const screen = render(
      <CommandEditor
        databaseType={"sqlite" as never}
        onChange={vi.fn()}
        onExecute={vi.fn()}
        value=""
      />
    );
    expect(screen.getByRole("textbox").element()).toHaveAttribute(
      "placeholder",
      "Enter command..."
    );
  });

  it("respects readOnly", () => {
    const screen = render(
      <CommandEditor
        databaseType="redis"
        onChange={vi.fn()}
        onExecute={vi.fn()}
        readOnly
        value="GET k"
      />
    );
    expect(screen.getByRole("textbox").element()).toHaveAttribute("readonly");
  });
});
