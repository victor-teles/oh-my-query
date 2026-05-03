import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import {
  ExplainErrorState,
  ExplainIdleState,
  ExplainUnsupportedState,
} from "./explain-empty-states";

describe("explainEmptyStates", () => {
  it("idle state shows the keyboard shortcut", () => {
    const screen = render(<ExplainIdleState />);
    expect(screen.getByText(/Run EXPLAIN/i)).toBeInTheDocument();
    expect(screen.getByText("⌘", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("⇧", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("E", { exact: true })).toBeInTheDocument();
  });

  it("unsupported state names the engine", () => {
    const screen = render(<ExplainUnsupportedState engine="sqlite" />);
    expect(screen.getByText("sqlite")).toBeInTheDocument();
    expect(screen.getByText(/not yet supported/i)).toBeInTheDocument();
  });

  it("error state renders the raw error message", () => {
    const screen = render(
      <ExplainErrorState message="relation does not exist" />
    );
    expect(screen.getByText("relation does not exist")).toBeInTheDocument();
  });
});
