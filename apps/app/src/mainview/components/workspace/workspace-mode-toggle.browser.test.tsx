import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { WorkspaceModeToggle } from "./workspace-mode-toggle";

describe("workspace-mode-toggle", () => {
  it("renders all three modes", () => {
    const screen = render(
      <WorkspaceModeToggle mode="editor" onChange={vi.fn()} />
    );

    expect(screen.getByRole("tab", { name: "Editor" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Split" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Chat" })).toBeInTheDocument();
    expect(screen.container).toMatchSnapshot();
  });

  it("marks the active mode via aria-selected", () => {
    const screen = render(
      <WorkspaceModeToggle mode="split" onChange={vi.fn()} />
    );

    expect(
      screen.getByRole("tab", { name: "Split" }).element()
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("tab", { name: "Editor" }).element()
    ).toHaveAttribute("aria-selected", "false");
  });

  it("emits the new mode value when a tab is clicked", async () => {
    const onChange = vi.fn();
    const screen = render(
      <WorkspaceModeToggle mode="editor" onChange={onChange} />
    );

    await screen.getByRole("tab", { name: "Split" }).click();
    expect(onChange).toHaveBeenLastCalledWith("split");

    await screen.getByRole("tab", { name: "Chat" }).click();
    expect(onChange).toHaveBeenLastCalledWith("chat");
  });
});
