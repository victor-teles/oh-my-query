import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { NoResultsState } from "./no-results-state";

describe("noResultsState", () => {
  it("renders rows copy when label is rows", () => {
    const screen = render(<NoResultsState label="rows" />);

    expect(screen.getByText("No results")).toBeInTheDocument();
    expect(screen.getByText(/returned no rows/i)).toBeInTheDocument();
  });

  it("renders documents copy when label is documents", () => {
    const screen = render(<NoResultsState label="documents" />);

    expect(screen.getByText(/returned no documents/i)).toBeInTheDocument();
  });

  it("hides the CTA when onEditQuery is not provided", () => {
    const screen = render(<NoResultsState label="rows" />);

    expect(
      screen.getByRole("button", { name: /edit query/i }).query()
    ).toBeNull();
  });

  it("renders an Edit query CTA when onEditQuery is provided", async () => {
    const onEditQuery = vi.fn();
    const screen = render(
      <NoResultsState label="rows" onEditQuery={onEditQuery} />
    );

    const button = screen.getByRole("button", { name: /edit query/i });
    await button.click();

    expect(onEditQuery).toHaveBeenCalledOnce();
  });
});
