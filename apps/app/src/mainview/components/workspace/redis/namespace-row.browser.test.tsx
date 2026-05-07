import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { NamespaceRow } from "./namespace-row";

describe("namespace-row", () => {
  it("renders the segment label and key count", () => {
    const screen = render(
      <NamespaceRow
        depth={0}
        fullName="users"
        isActive={false}
        isExpanded={false}
        keyCount={42}
        onToggle={vi.fn()}
        segment="users"
      />
    );
    expect(screen.getByText("users")).toBeVisible();
    expect(screen.getByText("42")).toBeVisible();
  });

  it("calls onToggle with fullName when clicked", async () => {
    const onToggle = vi.fn();
    const screen = render(
      <NamespaceRow
        depth={0}
        fullName="users"
        isActive={false}
        isExpanded={false}
        keyCount={1}
        onToggle={onToggle}
        segment="users"
      />
    );
    await screen.getByRole("button").click();
    expect(onToggle).toHaveBeenCalledWith("users");
  });

  it("exposes data-expanded when isExpanded", () => {
    const screen = render(
      <NamespaceRow
        depth={0}
        fullName="users"
        isActive={false}
        isExpanded
        keyCount={1}
        onToggle={vi.fn()}
        segment="users"
      />
    );
    expect(screen.getByRole("button").element()).toHaveAttribute(
      "data-expanded"
    );
  });
});
