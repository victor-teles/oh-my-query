import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ExplainErrorState,
  ExplainIdleState,
  ExplainUnsupportedState,
} from "./explain-empty-states";

describe("explainEmptyStates", () => {
  it("idle state shows the keyboard shortcut", () => {
    render(<ExplainIdleState />);
    expect(screen.getByText(/Run EXPLAIN/i)).toBeDefined();
    expect(screen.getByText("⌘")).toBeDefined();
    expect(screen.getByText("⇧")).toBeDefined();
    expect(screen.getByText("E")).toBeDefined();
  });

  it("unsupported state names the engine", () => {
    render(<ExplainUnsupportedState engine="sqlite" />);
    expect(screen.getByText("sqlite")).toBeDefined();
    expect(screen.getByText(/not yet supported/i)).toBeDefined();
  });

  it("error state renders the raw error message", () => {
    render(<ExplainErrorState message="relation does not exist" />);
    expect(screen.getByText("relation does not exist")).toBeDefined();
  });
});
