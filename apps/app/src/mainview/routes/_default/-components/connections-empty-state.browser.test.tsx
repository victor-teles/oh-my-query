import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { NoConnectionsState } from "./connections-empty-state";

describe("noConnectionsState", () => {
  it("renders the neutral empty copy", () => {
    const screen = render(<NoConnectionsState onAdd={vi.fn()} />);

    expect(screen.getByText("No connections yet")).toBeInTheDocument();
    expect(
      screen.getByText(/Saved connections live here/i)
    ).toBeInTheDocument();
  });

  it("exposes a single primary CTA", () => {
    const screen = render(<NoConnectionsState onAdd={vi.fn()} />);

    const buttons = screen.container.querySelectorAll("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.textContent).toContain("Add connection");
  });

  it("calls onAdd when the CTA is clicked", async () => {
    const onAdd = vi.fn();
    const screen = render(<NoConnectionsState onAdd={onAdd} />);

    await screen.getByRole("button", { name: /add connection/i }).click();

    expect(onAdd).toHaveBeenCalledOnce();
  });
});
