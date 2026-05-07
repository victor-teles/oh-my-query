import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { DialectSelector } from "./dialect-selector";

describe("dialect-selector", () => {
  it("does not show the transpile chip when value matches connectionDialect", () => {
    const screen = render(
      <DialectSelector
        connectionDialect="postgresql"
        onChange={vi.fn()}
        value="postgresql"
      />
    );
    expect(screen.getByRole("combobox")).toBeVisible();
    expect(screen.getByText(/Transpiling to/).query()).toBeNull();
  });

  it("shows transpile chip with display name when source dialect differs", async () => {
    const screen = render(
      <DialectSelector
        connectionDialect="postgresql"
        onChange={vi.fn()}
        value="mysql"
      />
    );
    await expect
      .poll(() => screen.getByRole("combobox").element().textContent)
      .toMatch(/MySQL/i);
  });

  it("calls onChange when the user picks another dialect", async () => {
    const onChange = vi.fn();
    const screen = render(
      <DialectSelector
        connectionDialect="postgresql"
        onChange={onChange}
        value="postgresql"
      />
    );
    await screen.getByRole("combobox").click();
    await screen.getByRole("option", { name: "MySQL" }).click();
    expect(onChange).toHaveBeenCalledWith("mysql");
  });
});
