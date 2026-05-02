import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { Badge } from "./badge";

describe("badge", () => {
  it("default", async () => {
    const screen = render(<Badge>Badge</Badge>);
    const badge = screen.getByText("Badge");
    await expect.element(badge).toBeVisible();
    await expect.element(badge).toMatchScreenshot();
  });

  it("secondary", async () => {
    const screen = render(<Badge variant="secondary">Badge</Badge>);
    const badge = screen.getByText("Badge");
    await expect.element(badge).toBeVisible();
    await expect.element(badge).toMatchScreenshot();
  });

  it("destructive", async () => {
    const screen = render(<Badge variant="destructive">Badge</Badge>);
    const badge = screen.getByText("Badge");
    await expect.element(badge).toBeVisible();
    await expect.element(badge).toMatchScreenshot();
  });

  it("outline", async () => {
    const screen = render(<Badge variant="outline">Badge</Badge>);
    const badge = screen.getByText("Badge");
    await expect.element(badge).toBeVisible();
    await expect.element(badge).toMatchScreenshot();
  });

  it("ghost", async () => {
    const screen = render(<Badge variant="ghost">Badge</Badge>);
    await expect.element(screen.getByText("Badge")).toMatchScreenshot();
  });

  it("link", async () => {
    const screen = render(<Badge variant="link">Badge</Badge>);
    await expect.element(screen.getByText("Badge")).toMatchScreenshot();
  });

  it("allVariants", async () => {
    const screen = render(
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="default">Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="destructive">Destructive</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="ghost">Ghost</Badge>
        <Badge variant="link">Link</Badge>
      </div>
    );
    for (const text of [
      "Default",
      "Secondary",
      "Destructive",
      "Outline",
      "Ghost",
      "Link",
    ]) {
      await expect.element(screen.getByText(text)).toBeVisible();
    }
    await expect.element(screen.container).toMatchScreenshot();
  });
});
