import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { Suggestion, Suggestions } from "./suggestion";

describe("suggestions", () => {
  it("wraps children in a horizontal scroll area", () => {
    const screen = render(
      <Suggestions>
        <Suggestion suggestion="One" />
        <Suggestion suggestion="Two" />
      </Suggestions>
    );

    expect(screen.getByRole("button", { name: "One" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Two" })).toBeInTheDocument();
    expect(screen.container).toMatchSnapshot();
  });
});

describe("suggestion", () => {
  it("uses the suggestion as the visible label by default", () => {
    const screen = render(<Suggestion suggestion="Find slow queries" />);
    expect(
      screen.getByRole("button", { name: "Find slow queries" })
    ).toBeInTheDocument();
    expect(screen.container).toMatchSnapshot();
  });

  it("prefers explicit children over the suggestion text", () => {
    const screen = render(
      <Suggestion suggestion="ignored">
        <span>Custom label</span>
      </Suggestion>
    );
    expect(
      screen.getByRole("button", { name: "Custom label" })
    ).toBeInTheDocument();
  });

  it("calls onClick with the suggestion string", async () => {
    const onClick = vi.fn();
    const screen = render(
      <Suggestion onClick={onClick} suggestion="Top users" />
    );

    await screen.getByRole("button", { name: "Top users" }).click();

    expect(onClick).toHaveBeenCalledExactlyOnceWith("Top users");
  });
});
