import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { CommandAction } from "@/components/command-palette/types";

import { CommandPalette } from "./command-palette";
import {
  CommandPaletteProvider,
  useCommandPalette,
} from "./command-palette-provider";
import { useRegisterCommandActions } from "./use-register-command-actions";

const Opener = () => {
  const { setOpen } = useCommandPalette();
  useEffect(() => {
    setOpen(true);
  }, [setOpen]);
  return null;
};

const Register = ({ actions }: { actions: CommandAction[] }) => {
  useRegisterCommandActions(actions, []);
  return null;
};

const renderPalette = (actions: CommandAction[] = []) =>
  render(
    <CommandPaletteProvider>
      <Register actions={actions} />
      <Opener />
      <CommandPalette />
    </CommandPaletteProvider>
  );

const navAction = (overrides: Partial<CommandAction> = {}): CommandAction => ({
  group: "Navigate",
  id: "nav.test",
  label: "Test action",
  perform: vi.fn(),
  ...overrides,
});

describe("command-palette", () => {
  it("renders an action item for each registered action", async () => {
    const screen = renderPalette([
      navAction({ id: "a", label: "First" }),
      navAction({ id: "b", label: "Second" }),
    ]);

    await expect.element(screen.getByText("First")).toBeInTheDocument();
    await expect.element(screen.getByText("Second")).toBeInTheDocument();
  });

  it("invokes perform when an action is selected", async () => {
    const perform = vi.fn();
    const screen = renderPalette([navAction({ label: "Run me", perform })]);

    await screen.getByText("Run me").click();

    await vi.waitFor(() => {
      expect(perform).toHaveBeenCalledOnce();
    });
  });

  it("requires a second selection to confirm destructive actions", async () => {
    const perform = vi.fn();
    const screen = renderPalette([
      navAction({
        confirm: true,
        destructive: true,
        id: "danger",
        label: "Dangerous",
        perform,
      }),
    ]);

    const item = screen.getByText("Dangerous");
    await item.click();

    expect(perform).not.toHaveBeenCalled();
    await expect
      .element(screen.getByText(/press ↵ again to confirm/i))
      .toBeInTheDocument();
  });

  it("hides actions whose when() returns false", () => {
    const screen = renderPalette([
      navAction({ id: "yes", label: "Visible", when: () => true }),
      navAction({ id: "no", label: "Hidden", when: () => false }),
    ]);

    expect(screen.getByText("Visible")).toBeInTheDocument();
    expect(screen.getByText("Hidden").query()).toBeNull();
  });
});
