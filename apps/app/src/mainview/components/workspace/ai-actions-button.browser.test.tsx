import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { AIActionsButton } from "./ai-actions-button";

describe("ai-actions-button", () => {
  it("opens the dropdown and dispatches generate", async () => {
    const onAction = vi.fn();
    const screen = render(
      <AIActionsButton hasError={false} hasQuery onAction={onAction} />
    );
    await screen.getByRole("button", { name: "AI actions" }).click();
    await screen.getByRole("menuitem", { name: /Generate SQL/ }).click();
    expect(onAction).toHaveBeenCalledWith("generate");
  });

  it("disables Explain when there is no query", async () => {
    const screen = render(
      <AIActionsButton hasError={false} hasQuery={false} onAction={vi.fn()} />
    );
    await screen.getByRole("button", { name: "AI actions" }).click();
    const explain = screen.getByRole("menuitem", { name: /Explain Query/ });
    expect(explain.element()).toHaveAttribute("data-disabled");
  });

  it("enables Fix when there is an error even without a query", async () => {
    const onAction = vi.fn();
    const screen = render(
      <AIActionsButton hasError hasQuery={false} onAction={onAction} />
    );
    await screen.getByRole("button", { name: "AI actions" }).click();
    await screen.getByRole("menuitem", { name: /Fix Query/ }).click();
    expect(onAction).toHaveBeenCalledWith("fix");
  });
});
