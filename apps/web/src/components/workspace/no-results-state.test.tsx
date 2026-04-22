import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NoResultsState } from "./no-results-state";

describe("noResultsState", () => {
  it("renders rows copy when label is rows", () => {
    render(<NoResultsState label="rows" />);

    expect(screen.getByText("No results")).toBeDefined();
    expect(screen.getByText(/returned no rows/i)).toBeDefined();
  });

  it("renders documents copy when label is documents", () => {
    render(<NoResultsState label="documents" />);

    expect(screen.getByText(/returned no documents/i)).toBeDefined();
  });

  it("hides the CTA when onEditQuery is not provided", () => {
    render(<NoResultsState label="rows" />);

    expect(screen.queryByRole("button", { name: /edit query/i })).toBeNull();
  });

  it("renders an Edit query CTA when onEditQuery is provided", async () => {
    const onEditQuery = vi.fn();
    render(<NoResultsState label="rows" onEditQuery={onEditQuery} />);

    const button = screen.getByRole("button", { name: /edit query/i });
    await userEvent.click(button);

    expect(onEditQuery).toHaveBeenCalledOnce();
  });
});
