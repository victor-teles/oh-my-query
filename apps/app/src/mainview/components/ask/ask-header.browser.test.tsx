import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { AskIndicatorState } from "./ask-indicator";

import { AskHeader } from "./ask-header";
import { CopySqlButton } from "./copy-sql-button";
import { SqlToggleButton } from "./sql-toggle-button";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const renderHeader = (
  indicator: AskIndicatorState,
  segments = ["PostgreSQL", "analytics"]
) =>
  render(
    <AskHeader
      heading="Generated SQL"
      indicator={indicator}
      segments={segments}
    >
      <span />
    </AskHeader>
  );

describe.each([
  ["full motion", false],
  ["reduced motion", true],
])("askHeader with %s", (_label, isReduced) => {
  it.each<[AskIndicatorState, string]>([
    ["busy", "Working"],
    ["success", "Done"],
    ["error", "Failed"],
  ])("shows the %s indicator", async (indicator, name) => {
    reduced.value = isReduced;
    const screen = renderHeader(indicator);
    await expect
      .element(screen.getByRole("heading", { name: "Generated SQL" }))
      .toBeVisible();
    await expect.element(screen.getByRole("img", { name })).toBeInTheDocument();
  });

  it("shows no indicator when idle", async () => {
    reduced.value = isReduced;
    const screen = renderHeader("idle");
    await expect
      .element(screen.getByRole("heading", { name: "Generated SQL" }))
      .toBeVisible();
    expect(screen.getByRole("img").query()).toBeNull();
  });

  it("swaps metadata segments as the ask advances", async () => {
    reduced.value = isReduced;
    const screen = renderHeader("busy");
    await expect.element(screen.getByText("analytics")).toBeVisible();
    await screen.rerender(
      <AskHeader
        heading="Generated SQL"
        indicator="success"
        segments={["PostgreSQL", "27 rows", "386ms"]}
      >
        <span />
      </AskHeader>
    );
    await expect.element(screen.getByText("27 rows")).toBeVisible();
    await expect.element(screen.getByText("386ms")).toBeVisible();
  });
});

describe("header actions", () => {
  it("copies and announces it", async () => {
    const onCopy = vi.fn();
    const screen = render(
      <CopySqlButton copied={false} disabled={false} onCopy={onCopy} />
    );
    await screen.getByRole("button", { name: "Copy SQL" }).click();
    expect(onCopy).toHaveBeenCalledOnce();

    await screen.rerender(
      <CopySqlButton copied disabled={false} onCopy={onCopy} />
    );
    await expect.element(screen.getByText("Copied")).toBeInTheDocument();
  });

  it("toggles the SQL and reports its state", async () => {
    const onToggle = vi.fn();
    const screen = render(
      <SqlToggleButton disabled={false} expanded onToggle={onToggle} />
    );
    const button = screen.getByRole("button", { name: "Hide SQL" });
    await expect.element(button).toHaveAttribute("aria-expanded", "true");
    await button.click();
    expect(onToggle).toHaveBeenCalledOnce();

    await screen.rerender(
      <SqlToggleButton disabled expanded={false} onToggle={onToggle} />
    );
    await expect
      .element(screen.getByRole("button", { name: "Show SQL" }))
      .toBeDisabled();
  });
});
