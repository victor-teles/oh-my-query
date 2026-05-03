import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { Spinner } from "./spinner";

describe("spinner", () => {
  it("default", async () => {
    const screen = render(<Spinner />);
    const spinner = screen.getByRole("status");
    expect(spinner).toBeVisible();
    expect(spinner).toHaveAttribute("aria-label", "Loading");
    await expect(spinner.element()).toMatchSnapshot();
  });

  it("large", () => {
    const screen = render(<Spinner className="size-8" />);
    expect(screen.getByRole("status")).toBeVisible();
    expect(screen.getByRole("status").element()).toMatchSnapshot();
  });

  it("small", () => {
    const screen = render(<Spinner className="size-3" />);
    expect(screen.getByRole("status")).toBeVisible();
    expect(screen.getByRole("status").element()).toMatchSnapshot();
  });
});
