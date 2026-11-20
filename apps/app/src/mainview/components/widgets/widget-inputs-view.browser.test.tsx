import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import type { WidgetDraft } from "@/lib/ipc";

import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";
import { makeWidget } from "@/test/widget-fixtures";

import { draftFromWidget } from "./widget-draft";
import { WidgetInputsView } from "./widget-inputs-view";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const { id: _id, ...proposal } = draftFromWidget(makeWidget());

const setup = (
  draft: WidgetDraft = proposal,
  mode: "create" | "edit" = "create"
) => {
  const saveWidget = vi.fn((payload: Record<string, unknown>) => ({
    ...makeWidget(),
    ...(payload.widget as object),
    id: "w-new",
  }));
  mockLauncherIpc({ handlers: { saveWidget } });
  const onSaved = vi.fn();
  const onBack = vi.fn();
  const screen = renderWithConnections(
    <div style={{ width: 760 }}>
      <WidgetInputsView
        draft={draft}
        mode={mode}
        onBack={onBack}
        onSaved={onSaved}
      />
    </div>
  );
  return { onBack, onSaved, saveWidget, screen };
};

const savedParams = (saveWidget: ReturnType<typeof setup>["saveWidget"]) => {
  const payload = saveWidget.mock.calls[0]?.[0] as
    | { widget: WidgetDraft }
    | undefined;
  return payload?.widget.params;
};

describe.each([
  ["full motion", false],
  ["reduced motion", true],
])("widgetInputsView with %s", (_label, isReduced) => {
  it("lists each proposed input with its type and default", async () => {
    reduced.value = isReduced;
    const { screen } = setup();
    const rows = screen
      .getByRole("list", { name: "Inputs" })
      .getByRole("listitem");
    await expect.element(rows.first()).toHaveTextContent("Choice");
    await expect.element(rows.nth(1)).toHaveTextContent("Date range");
    await expect
      .element(screen.getByRole("button", { name: "Period: Last quarter" }))
      .toBeVisible();
    expect(screen.container).toMatchSnapshot();
  });

  it("removes an input with ⌫ and closes the gap", async () => {
    reduced.value = isReduced;
    const { screen } = setup();
    const row = screen.getByRole("listitem", { name: "Region input" });
    row.element().focus();
    await userEvent.keyboard("{Backspace}");
    await expect
      .poll(() =>
        screen.getByRole("listitem", { name: "Region input" }).query()
      )
      .toBeNull();
    await expect.element(screen.getByText("1 input")).toBeVisible();
  });
});

describe("widgetInputsView saving", () => {
  it("saves renamed labels and a new default with ⌘↵", async () => {
    reduced.value = false;
    const { onSaved, saveWidget, screen } = setup();
    await screen
      .getByRole("textbox", { name: "Label for region" })
      .fill("Market");
    await screen
      .getByRole("textbox", { name: "Widget name" })
      .fill("MRR by market");
    await screen.getByRole("button", { name: "Period: Last quarter" }).click();
    await screen.getByRole("option", { name: "Year to date" }).click();
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");

    await expect.poll(() => onSaved.mock.calls.length).toBe(1);
    const call = saveWidget.mock.calls[0]?.[0] as { widget: WidgetDraft };
    expect(call.widget.name).toBe("MRR by market");
    expect(savedParams(saveWidget)).toMatchObject([
      { label: "Market", name: "region" },
      { default: "ytd", name: "period" },
    ]);
  });

  it("keeps a removed input bound as a fixed value", async () => {
    const { onSaved, saveWidget, screen } = setup();
    await screen.getByRole("button", { name: "Remove Region" }).click();
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    await expect.poll(() => onSaved.mock.calls.length).toBe(1);
    expect(savedParams(saveWidget)).toMatchObject([
      { default: "Europe", fixed: true, name: "region" },
      { name: "period" },
    ]);
  });

  it("asks for a name before saving", async () => {
    const { saveWidget, screen } = setup();
    await screen.getByRole("textbox", { name: "Widget name" }).fill("  ");
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("Give the widget a name.");
    expect(saveWidget).not.toHaveBeenCalled();
  });

  it("shows a save failure", async () => {
    mockLauncherIpc({
      handlers: {
        saveWidget: () => {
          throw new Error("The template no longer compiles.");
        },
      },
    });
    const screen = renderWithConnections(
      <WidgetInputsView
        draft={proposal}
        mode="edit"
        onBack={vi.fn()}
        onSaved={vi.fn()}
      />
    );
    await expect.element(screen.getByText("Edit inputs")).toBeVisible();
    await screen.getByRole("textbox", { name: "Widget name" }).click();
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("The template no longer compiles.");
  });

  it("explains a widget with no inputs", async () => {
    const { screen } = setup({ ...proposal, params: [] });
    await expect
      .element(
        screen.getByText("No inputs. The widget always runs the same query.")
      )
      .toBeVisible();
  });
});
