import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { CommandRow } from "./command-row";
import { LauncherListbox, LauncherSection } from "./launcher-list";
import { LauncherRow, optionId } from "./launcher-row";
import { rootCommands } from "./root-commands";

const commands = rootCommands({
  addConnection: vi.fn(),
  dismiss: vi.fn(),
  exportAll: vi.fn(),
  newBoard: vi.fn(),
  openHistory: vi.fn(),
  openImport: vi.fn(),
  openSettings: vi.fn(),
});

const renderList = (selectedId: string, onHover = vi.fn(), onRun = vi.fn()) =>
  render(
    <LauncherListbox id="list" label="Results">
      <LauncherSection label="Commands">
        {commands.map((command) => (
          <CommandRow
            command={command}
            key={command.id}
            onHover={onHover}
            onRun={onRun}
            selected={command.id === selectedId}
          />
        ))}
      </LauncherSection>
    </LauncherListbox>
  );

describe("launcher list", () => {
  it("renders a listbox with a labelled group of options", async () => {
    const screen = renderList("settings");

    await expect
      .element(screen.getByRole("listbox", { name: "Results" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("group", { name: "Commands" }))
      .toBeVisible();
    expect(screen.getByRole("option").all()).toHaveLength(7);
    expect(screen.getByRole("option", { name: /Settings/ }).element().id).toBe(
      optionId("settings")
    );
  });

  it("marks only the selected option", async () => {
    const screen = renderList("hide");

    await expect
      .element(screen.getByRole("option", { name: /Hide Launcher/ }))
      .toHaveAttribute("aria-selected", "true");
    await expect
      .element(screen.getByRole("option", { name: /Settings/ }))
      .toHaveAttribute("aria-selected", "false");
  });

  it("selects on hover and runs on click by id", async () => {
    const onHover = vi.fn();
    const onRun = vi.fn();
    const screen = renderList("settings", onHover, onRun);

    const hide = screen.getByRole("option", { name: /Hide Launcher/ });
    await hide.hover();
    expect(onHover).toHaveBeenCalledWith("hide");
    await hide.click();
    expect(onRun).toHaveBeenCalledWith("hide");
  });

  it("tints a destructive row", async () => {
    const screen = render(
      <LauncherRow
        id="danger"
        onHover={vi.fn()}
        onRun={vi.fn()}
        selected
        tone="destructive"
      >
        Delete
      </LauncherRow>
    );

    await expect
      .element(screen.getByRole("option"))
      .toHaveAttribute("data-tone", "destructive");
  });
});
