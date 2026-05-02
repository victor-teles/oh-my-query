import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { Spinner } from "./spinner";

describe("spinner", () => {
  it("default", async () => {
    const screen = render(<Spinner />);
    const spinner = screen.getByRole("status");
    await expect.element(spinner).toBeVisible();
    await expect.element(spinner).toHaveAttribute("aria-label", "Loading");
    await expect.element(spinner).toMatchScreenshot();
  });

  it("large", async () => {
    const screen = render(<Spinner className="size-8" />);
    await expect.element(screen.getByRole("status")).toBeVisible();
    await expect.element(screen.getByRole("status")).toMatchScreenshot();
  });

  it("small", async () => {
    const screen = render(<Spinner className="size-3" />);
    await expect.element(screen.getByRole("status")).toBeVisible();
    await expect.element(screen.getByRole("status")).toMatchScreenshot();
  });
});
