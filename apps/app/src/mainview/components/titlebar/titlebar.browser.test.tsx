import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { Titlebar } from "./titlebar";

describe("titlebar", () => {
  it("renders the no-sidebar branch with center + trailing children", () => {
    const screen = render(
      <Titlebar center={<span>Center slot</span>}>
        <button type="button">Action</button>
      </Titlebar>
    );

    expect(screen.getByText("Center slot")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
    expect(screen.container).toMatchSnapshot();
  });

  it("renders the sidebar branch when leading is provided", () => {
    const screen = render(
      <Titlebar
        center={<span>Center</span>}
        leading={<span>Leading slot</span>}
        leadingWidth="200px"
      >
        <span>Trailing</span>
      </Titlebar>
    );

    expect(screen.getByText("Leading slot")).toBeInTheDocument();
    expect(screen.getByText("Center")).toBeInTheDocument();
    expect(screen.getByText("Trailing")).toBeInTheDocument();
    expect(screen.container).toMatchSnapshot();
  });

  it("omits the trailing region when no children are passed", () => {
    const screen = render(<Titlebar center={<span>Only center</span>} />);
    expect(screen.getByText("Only center")).toBeInTheDocument();
  });
});
