import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { WelcomeState } from "./welcome-state";

describe("welcomeState", () => {
  it("renders the welcome copy", () => {
    const screen = render(<WelcomeState onAdd={vi.fn()} />);

    expect(screen.getByText("Welcome to oh-my-query")).toBeInTheDocument();
    expect(
      screen.getByText(/A quiet home for your databases/i)
    ).toBeInTheDocument();
  });

  it("exposes a single primary CTA", () => {
    const screen = render(<WelcomeState onAdd={vi.fn()} />);

    const buttons = screen.container.querySelectorAll("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.textContent).toContain("Add your first connection");
  });

  it("calls onAdd when the CTA is clicked", async () => {
    const onAdd = vi.fn();
    const screen = render(<WelcomeState onAdd={onAdd} />);

    await screen
      .getByRole("button", { name: /add your first connection/i })
      .click();

    expect(onAdd).toHaveBeenCalledOnce();
  });
});
