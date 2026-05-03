import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { CommandAction } from "@/components/command-palette/types";

import {
  CommandPaletteProvider,
  useCommandPalette,
} from "./command-palette-provider";
import { useRegisterCommandActions } from "./use-register-command-actions";

const action = (id: string, group = "Navigate"): CommandAction => ({
  group: group as CommandAction["group"],
  id,
  label: `Action ${id}`,
  perform: vi.fn(),
});

const captured: { api: ReturnType<typeof useCommandPalette> | null } = {
  api: null,
};

const Capture = () => {
  const api = useCommandPalette();
  captured.api = api;
  return (
    <div>
      <span data-testid="open">{api.open ? "open" : "closed"}</span>
      <span data-testid="count">{api.actions.length}</span>
      <span data-testid="recent">{api.recentIds.join(",")}</span>
    </div>
  );
};

const Register = ({ actions }: { actions: CommandAction[] }) => {
  useRegisterCommandActions(actions, []);
  return null;
};

const renderShell = (actions?: CommandAction[]) => {
  captured.api = null;
  return render(
    <CommandPaletteProvider>
      {actions ? <Register actions={actions} /> : null}
      <Capture />
    </CommandPaletteProvider>
  );
};

const getApi = () => captured.api;

describe("command-palette-provider", () => {
  it("starts closed and toggles open via setOpen", async () => {
    const screen = renderShell();

    expect(screen.getByTestId("open").element().textContent).toBe("closed");
    getApi()?.setOpen(true);
    await expect.element(screen.getByTestId("open")).toHaveTextContent("open");
  });

  it("exposes actions registered by children and dedupes by id", () => {
    const screen = renderShell([action("a"), action("b"), action("a")]);
    expect(screen.getByTestId("count").element().textContent).toBe("2");
  });

  it("removes actions when the registration is unmounted", () => {
    const screen = renderShell([action("a")]);
    expect(screen.getByTestId("count").element().textContent).toBe("1");
    screen.unmount();

    const second = renderShell();
    expect(second.getByTestId("count").element().textContent).toBe("0");
  });

  it("records recent ids and persists them (capped at 3)", async () => {
    const screen = renderShell();

    getApi()?.recordUse("a");
    getApi()?.recordUse("b");
    getApi()?.recordUse("c");
    getApi()?.recordUse("d");

    await expect
      .element(screen.getByTestId("recent"))
      .toHaveTextContent("d,c,b");
    expect(
      window.localStorage.getItem("oh-my-query.command-palette.recent")
    ).toBe(JSON.stringify(["d", "c", "b"]));
  });

  it("moves an existing id to the front of recents on re-use", async () => {
    const screen = renderShell();

    getApi()?.recordUse("a");
    getApi()?.recordUse("b");
    getApi()?.recordUse("a");

    await expect.element(screen.getByTestId("recent")).toHaveTextContent("a,b");
  });
});
