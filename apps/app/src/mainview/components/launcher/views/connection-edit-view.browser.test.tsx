import { beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { makeConnection } from "@/test/connection-fixture";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";

import { ConnectionEditView, POP_AFTER_SAVE_MS } from "./connection-edit-view";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const analytics = makeConnection({ id: "analytics", name: "analytics" });

const renderEditor = (connectionId: string | null, onBack = vi.fn()) => {
  const store = mockLauncherIpc({ connections: [analytics] });
  const screen = renderWithConnections(
    <ConnectionEditView connectionId={connectionId} onBack={onBack} />
  );
  return { onBack, screen, store };
};

const resetMotion = () => {
  reduced.value = false;
};

describe("connectionEditView", () => {
  beforeEach(resetMotion);

  it("edits an existing connection", async () => {
    const { screen } = renderEditor("analytics");

    await expect
      .element(screen.getByRole("heading", { name: "Edit analytics" }))
      .toBeVisible();
    await expect
      .element(screen.getByLabelText("Connection name"))
      .toHaveValue("analytics");
    await expect
      .element(screen.getByText("Save", { exact: true }))
      .toBeVisible();
    expect(screen.container).toMatchSnapshot();
  });

  it("says so when the connection is gone", async () => {
    const { screen } = renderEditor("missing");

    await expect
      .element(screen.getByRole("status"))
      .toHaveTextContent("This connection no longer exists.");
  });

  it("goes back from the header", async () => {
    const { onBack, screen } = renderEditor(null);
    await screen.getByRole("button", { name: "Back" }).click();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("keeps the editor open when validation fails", async () => {
    const { onBack, screen } = renderEditor(null);
    const name = screen.getByLabelText("Connection name");
    await name.click();
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");

    expect((name.element() as HTMLInputElement).validity.valid).toBeFalsy();
    await expect
      .element(screen.getByRole("heading", { name: "New Connection" }))
      .toBeVisible();
    expect(onBack).not.toHaveBeenCalled();
  });
});

describe.each([
  ["full motion", false, POP_AFTER_SAVE_MS],
  ["reduced motion", true, 0],
])("saving with %s", (_label, isReduced, popDelay) => {
  beforeEach(resetMotion);

  it("saves with Command-Enter, confirms, then pops", async () => {
    reduced.value = isReduced;
    const { onBack, screen, store } = renderEditor("analytics");
    const name = screen.getByLabelText("Connection name");
    await name.fill("analytics-eu");
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");

    await expect
      .element(screen.getByRole("img", { name: "Saved" }))
      .toBeVisible();
    await expect
      .element(screen.getByText("Saved", { exact: true }))
      .toBeVisible();
    expect(store.connections[0]?.name).toBe("analytics-eu");
    await expect
      .poll(() => onBack.mock.calls.length, { timeout: popDelay + 1000 })
      .toBe(1);
  });
});
