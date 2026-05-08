import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

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

  it("shows the transpile badge with the target dialect label", async () => {
    const screen = render(
      <DialectSelector
        connectionDialect="postgresql"
        onChange={vi.fn()}
        value="mysql"
      />
    );
    // The badge wraps a lucide icon; hovering it opens the tooltip whose
    // content names the *target* (connection) dialect, not the SELECT value.
    const badge = screen.container.querySelector(
      "span.text-amber-500"
    ) as HTMLElement | null;
    expect(badge).not.toBeNull();
    await page.elementLocator(badge as HTMLElement).hover();
    await expect
      .poll(() => page.getByText("Transpiling to PostgreSQL").query() !== null)
      .toBe(true);
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
