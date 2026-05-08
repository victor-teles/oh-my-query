import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import Loader from "./loader";

describe("loader", () => {
  it("renders a centered spinner", () => {
    const screen = render(<Loader />);
    expect(screen.container).toMatchSnapshot();
  });
});
