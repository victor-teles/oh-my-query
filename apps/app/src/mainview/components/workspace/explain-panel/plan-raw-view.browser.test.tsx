import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { PlanRawView } from "./plan-raw-view";

describe("plan-raw-view", () => {
  it("renders the raw plan text", () => {
    const screen = render(<PlanRawView raw="Seq Scan on users" />);
    expect(screen.getByText("Seq Scan on users")).toBeVisible();
  });

  it("copies to the clipboard and updates the button label", async () => {
    const writeText = vi.fn(async () => {
      await Promise.resolve();
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const screen = render(<PlanRawView raw="hello" />);
    await screen.getByRole("button", { name: "Copy raw plan" }).click();
    expect(writeText).toHaveBeenCalledWith("hello");
    await expect.poll(() => screen.getByText("Copied").query()).not.toBeNull();
  });
});
