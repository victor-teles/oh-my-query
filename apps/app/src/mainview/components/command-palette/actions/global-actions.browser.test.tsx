import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { CommandAction } from "@/components/command-palette/types";

import {
  CommandPaletteProvider,
  useCommandPalette,
} from "@/components/command-palette/command-palette-provider";
import { ThemeProvider } from "@/components/theme-provider";

import { GlobalCommandActions } from "./global-actions";

const navigate = vi.fn();
vi.mock(import("@tanstack/react-router"), () => ({
  useNavigate: () => navigate,
}));

const captured: { actions: CommandAction[] } = { actions: [] };

const Capture = () => {
  const { actions } = useCommandPalette();
  captured.actions = actions;
  return null;
};

const renderActions = () => {
  captured.actions = [];
  return render(
    <ThemeProvider defaultTheme="light">
      <CommandPaletteProvider>
        <GlobalCommandActions />
        <Capture />
      </CommandPaletteProvider>
    </ThemeProvider>
  );
};

const findAction = (id: string): CommandAction => {
  const action = captured.actions.find((a) => a.id === id);
  if (!action) {
    throw new Error(`Action ${id} was not registered`);
  }
  return action;
};

describe("global-command-actions", () => {
  it("registers nav home, nav settings, and theme toggle", () => {
    renderActions();
    expect(captured.actions.map((a) => a.id)).toStrictEqual(
      expect.arrayContaining(["nav.home", "nav.settings", "view.toggle-theme"])
    );
  });

  it("nav.home perform navigates to /", async () => {
    navigate.mockClear();
    renderActions();

    await findAction("nav.home").perform();
    expect(navigate).toHaveBeenCalledExactlyOnceWith({ to: "/" });
  });

  it("nav.settings perform navigates to /settings", async () => {
    navigate.mockClear();
    renderActions();

    await findAction("nav.settings").perform();
    expect(navigate).toHaveBeenCalledExactlyOnceWith({ to: "/settings" });
  });

  it("labels the theme toggle for the resolved theme", () => {
    renderActions();
    const toggle = findAction("view.toggle-theme");
    expect(toggle.label).toMatch(/dark mode/i);
  });
});
