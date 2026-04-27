import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NoConnectionsState } from "./connections-empty-state";

describe("noConnectionsState", () => {
  it("renders the neutral empty copy", () => {
    render(<NoConnectionsState onAdd={vi.fn()} />);

    expect(screen.getByText("No connections yet")).toBeDefined();
    expect(screen.getByText(/Saved connections live here/i)).toBeDefined();
  });

  it("exposes a single primary CTA", () => {
    render(<NoConnectionsState onAdd={vi.fn()} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.textContent).toContain("Add connection");
  });

  it("calls onAdd when the CTA is clicked", async () => {
    const onAdd = vi.fn();
    render(<NoConnectionsState onAdd={onAdd} />);

    await userEvent.click(
      screen.getByRole("button", { name: /add connection/i })
    );

    expect(onAdd).toHaveBeenCalledOnce();
  });
});
