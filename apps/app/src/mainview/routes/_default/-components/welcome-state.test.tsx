import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WelcomeState } from "./welcome-state";

describe("welcomeState", () => {
  it("renders the welcome copy", () => {
    render(<WelcomeState onAdd={vi.fn()} />);

    expect(screen.getByText("Welcome to oh-my-query")).toBeDefined();
    expect(screen.getByText(/A quiet home for your databases/i)).toBeDefined();
  });

  it("exposes a single primary CTA", () => {
    render(<WelcomeState onAdd={vi.fn()} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.textContent).toContain("Add your first connection");
  });

  it("calls onAdd when the CTA is clicked", async () => {
    const onAdd = vi.fn();
    render(<WelcomeState onAdd={onAdd} />);

    await userEvent.click(
      screen.getByRole("button", { name: /add your first connection/i })
    );

    expect(onAdd).toHaveBeenCalledOnce();
  });
});
