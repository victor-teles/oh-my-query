import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { Badge } from "./badge";

describe("badge", () => {
  it("default", () => {
    const screen = render(<Badge>Badge</Badge>);
    const badge = screen.getByText("Badge");
    expect(badge).toBeVisible();
    expect(badge.element()).toMatchSnapshot();
  });

  it("secondary", () => {
    const screen = render(<Badge variant="secondary">Badge</Badge>);
    const badge = screen.getByText("Badge");
    expect(badge).toBeVisible();
    expect(badge.element()).toMatchSnapshot();
  });

  it("destructive", () => {
    const screen = render(<Badge variant="destructive">Badge</Badge>);
    const badge = screen.getByText("Badge");
    expect(badge).toBeVisible();
    expect(badge.element()).toMatchSnapshot();
  });

  it("outline", () => {
    const screen = render(<Badge variant="outline">Badge</Badge>);
    const badge = screen.getByText("Badge");
    expect(badge).toBeVisible();
    expect(badge.element()).toMatchSnapshot();
  });

  it("ghost", () => {
    const screen = render(<Badge variant="ghost">Badge</Badge>);
    expect(screen.getByText("Badge").element()).toMatchSnapshot();
  });

  it("link", () => {
    const screen = render(<Badge variant="link">Badge</Badge>);
    expect(screen.getByText("Badge").element()).toMatchSnapshot();
  });

  it("allVariants", () => {
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
      expect(screen.getByText(text)).toBeVisible();
    }
    expect(screen.container).toMatchSnapshot();
  });
});
