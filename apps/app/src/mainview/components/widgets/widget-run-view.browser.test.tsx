import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import type { WidgetRunResult } from "@/lib/ipc";

import { makeConnection } from "@/test/connection-fixture";
import { ipcHandlerRegistry } from "@/test/ipc-handler-registry";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";
import { wait } from "@/test/wait";
import { makeKpiWidget, makeWatch } from "@/test/watch-fixtures";
import { makeWidget, runResult } from "@/test/widget-fixtures";

import { WidgetRunView } from "./widget-run-view";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const analytics = makeConnection({ id: "analytics", name: "analytics" });

type RunHandler = (payload: Record<string, unknown>) => unknown;

interface SetupOptions {
  runWidget?: RunHandler;
  widget?: ReturnType<typeof makeWidget>;
  connections?: ReturnType<typeof makeConnection>[];
}

const setup = ({
  runWidget = () => runResult(),
  widget = makeWidget(),
  connections = [analytics],
}: SetupOptions = {}) => {
  const calls = {
    ask: vi.fn(),
    cancelWidgetRun: vi.fn(),
    deleteWidget: vi.fn(),
    proposeWidgetParams: vi.fn(),
    runWidget: vi.fn(runWidget),
    saveWidget: vi.fn((payload: Record<string, unknown>) => ({
      ...widget,
      ...(payload.widget as object),
    })),
  };
  mockLauncherIpc({
    connections,
    handlers: { ...calls, listWidgets: () => [widget] },
  });
  const onClose = vi.fn();
  const onEditInputs = vi.fn();
  const onAddToBoard = vi.fn();
  const onWatch = vi.fn();
  renderWithConnections(
    <div data-testid="run-harness" style={{ width: 760 }}>
      <WidgetRunView
        initialValues={{}}
        onAddToBoard={onAddToBoard}
        onClose={onClose}
        onEditInputs={onEditInputs}
        onWatch={onWatch}
        widgetId={widget.id}
      />
    </div>
  );
  const screen = page.getByTestId("run-harness");
  return { calls, onAddToBoard, onClose, onEditInputs, onWatch, screen };
};

const deferred = () => {
  const pending: ((value: WidgetRunResult) => void)[] = [];
  const handler: RunHandler = () => {
    const { promise, resolve } = Promise.withResolvers<WidgetRunResult>();
    pending.push(resolve);
    return promise;
  };
  return {
    handler,
    resolveNext: async (value: WidgetRunResult) => {
      await expect.poll(() => pending.length).toBeGreaterThan(0);
      pending.shift()?.(value);
    },
  };
};

describe.each([
  ["full motion", false],
  ["reduced motion", true],
])("widgetRunView with %s", (_label, isReduced) => {
  it("runs on open with the last values and never asks the model", async () => {
    reduced.value = isReduced;
    const { calls, screen } = await setup();
    await expect
      .element(screen.getByRole("region", { name: "Revenue by region" }))
      .toBeVisible();
    expect(calls.runWidget).toHaveBeenCalledWith(
      expect.objectContaining({
        values: { period: "lastQuarter", region: "Europe" },
        widgetId: "w-revenue",
      })
    );
    expect(calls.ask).not.toHaveBeenCalled();
    expect(calls.proposeWidgetParams).not.toHaveBeenCalled();
    await expect.element(screen.getByText("3 rows · 386 ms")).toBeVisible();
    await expect
      .element(screen.getByText("Europe · Last quarter"))
      .toBeVisible();
    expect(screen.getByText("Europe grew every month.").query()).toBeNull();
  });

  it("keeps the previous card dimmed with a progress line while rerunning", async () => {
    reduced.value = isReduced;
    const run = deferred();
    const { screen } = await setup({ runWidget: run.handler });
    await run.resolveNext(runResult());
    await expect
      .element(screen.getByRole("region", { name: "Revenue by region" }))
      .toBeVisible();

    await screen.getByRole("combobox", { name: "Region" }).fill("north");
    await userEvent.keyboard("{Enter}");

    await expect
      .element(screen.getByTestId("run-progress"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByRole("region", { name: "Revenue by region" }))
      .toBeVisible();
    expect(screen.getByText("Europe · Last quarter").query()).not.toBeNull();

    await run.resolveNext(
      runResult({ period: "lastQuarter", region: "North America" })
    );
    await expect
      .element(screen.getByText("North America · Last quarter"))
      .toBeVisible();
    await expect
      .poll(() => screen.getByTestId("run-progress").query())
      .toBeNull();
  });
});

describe("widgetRunView states", () => {
  it("shows a skeleton only when the first run takes longer than 150ms", async () => {
    reduced.value = false;
    const run = deferred();
    const { screen } = await setup({ runWidget: run.handler });
    expect(screen.getByTestId("ask-skeleton").query()).toBeNull();
    await wait(200);
    await expect
      .element(screen.getByTestId("ask-skeleton"))
      .toBeInTheDocument();
    await expect
      .poll(() =>
        screen.element().querySelector('[data-slot="swap-text"] > span + span')
      )
      .toBeNull();
    await expect
      .poll(
        () =>
          screen
            .getByRole("button", { name: "Stop" })
            .element()
            .querySelectorAll("svg").length
      )
      .toBe(1);
    expect(page.getByTestId("run-harness").element()).toMatchSnapshot();
    await run.resolveNext(runResult());
  });

  it("matches the snapshot for a populated run", async () => {
    reduced.value = true;
    // A pointer left over the chart by an earlier file would open its tooltip.
    await page
      .elementLocator(document.body)
      .hover({ position: { x: 0, y: 0 } });
    const { screen } = await setup();
    await expect.element(screen.getByText("3 rows · 386 ms")).toBeVisible();
    await expect
      .poll(() => screen.element().querySelector(".recharts-surface"))
      .not.toBeNull();
    await expect
      .poll(() =>
        screen.element().querySelector('[data-slot="swap-text"] > span + span')
      )
      .toBeNull();
    expect(screen.element()).toMatchSnapshot();
  });

  it("explains an empty result", async () => {
    const empty = runResult();
    const { screen } = await setup({
      runWidget: () => ({
        ...empty,
        result: { ...empty.result, rowCount: 0, rows: [] },
      }),
    });
    await expect
      .element(screen.getByText("No rows for these inputs."))
      .toBeVisible();
    expect(screen.element()).toMatchSnapshot();
  });

  it("maps a database error and retries", async () => {
    const runWidget = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('relation "revenue" does not exist'), {
          code: "QUERY_FAILED",
        })
      )
      .mockResolvedValue(runResult());
    const { screen } = await setup({ runWidget });
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent('The query failed.relation "revenue" does not exist');
    expect(screen.element()).toMatchSnapshot();
    await screen.getByRole("button", { name: "Retry" }).click();
    await expect
      .element(screen.getByRole("region", { name: "Revenue by region" }))
      .toBeVisible();
  });

  it("offers another connection when the widget's one is gone", async () => {
    const billing = makeConnection({ id: "billing", name: "billing" });
    const runWidget = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("gone"), { code: "CONNECTION_MISSING" })
      )
      .mockResolvedValue(runResult());
    const { calls, screen } = await setup({
      connections: [billing],
      runWidget,
      widget: makeWidget({ connectionId: "deleted" }),
    });
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("This widget's connection no longer exists.");
    await screen.getByRole("button", { name: "billing" }).click();
    await expect.poll(() => calls.saveWidget.mock.calls.length).toBe(1);
    expect(calls.saveWidget.mock.calls[0]?.[0]).toMatchObject({
      widget: { connectionId: "billing", id: "w-revenue" },
    });
    await expect.poll(() => runWidget.mock.calls.length).toBe(2);
  });

  it("says when the widget no longer exists", async () => {
    mockLauncherIpc({ handlers: { listWidgets: () => [] } });
    renderWithConnections(
      <WidgetRunView
        initialValues={{}}
        onAddToBoard={vi.fn()}
        onClose={vi.fn()}
        onEditInputs={vi.fn()}
        onWatch={vi.fn()}
        widgetId="missing"
      />
    );
    await expect
      .element(page.getByText("This widget no longer exists."))
      .toBeVisible();
  });
});

describe("widgetRunView actions", () => {
  const openMenu = async (
    screen: Awaited<ReturnType<typeof setup>>["screen"]
  ) => {
    await expect.element(screen.getByText("3 rows · 386 ms")).toBeVisible();
    await screen.getByRole("button", { name: "Run" }).click();
    await userEvent.keyboard("{Meta>}k{/Meta}");
    return screen.getByRole("menu", { name: "Actions for Revenue by region" });
  };

  it("opens the watch view from the actions", async () => {
    const { onWatch, screen } = await setup();
    const menu = await openMenu(screen);
    expect(
      menu.getByRole("menuitem", { name: "Show in Menu Bar" }).query()
    ).toBeNull();
    await menu.getByRole("menuitem", { name: "Watch…" }).click();
    expect(onWatch).toHaveBeenCalledWith("w-revenue");
  });

  it("pins a KPI widget to the menu bar from the actions", async () => {
    const saveWatch = vi.fn((payload: Record<string, unknown>) => ({
      ...makeWatch({ widgetId: "w-revenue" }),
      ...(payload.watch as object),
    }));
    const { screen } = await setup({
      widget: makeKpiWidget({ id: "w-revenue", name: "Revenue by region" }),
    });
    ipcHandlerRegistry.saveWatch = saveWatch;
    const menu = await openMenu(screen);
    await menu.getByRole("menuitem", { name: "Show in Menu Bar" }).click();
    expect(saveWatch).toHaveBeenCalledWith({
      watch: expect.objectContaining({ menuBar: true, widgetId: "w-revenue" }),
    });
    await expect.element(screen.getByText("In the menu bar")).toBeVisible();
  });

  it("adds the widget to a board from the actions", async () => {
    const { onAddToBoard, screen } = await setup();
    const menu = await openMenu(screen);
    await menu.getByRole("menuitem", { name: "Add to Board" }).click();
    expect(onAddToBoard).toHaveBeenCalledWith("w-revenue");
  });

  it("lists the shared export actions before the widget's own", async () => {
    const { screen } = await setup();
    const menu = await openMenu(screen);
    await expect.element(menu).toBeVisible();
    const labels = menu
      .getByRole("menuitem")
      .elements()
      .map((item) => item.textContent?.replace(/⌘.*/u, ""));
    expect(labels).toStrictEqual([
      "Copy SQL",
      "Copy as CSV",
      "Copy as TSV",
      "Copy as Markdown",
      "Copy Chart as PNG",
      "Save CSV to Downloads",
      "Edit Inputs",
      "Rename",
      "Duplicate",
      "Add to Board",
      "Watch…",
      "Delete",
    ]);
    expect(menu.element()).toMatchSnapshot();
  });

  it("copies the rows as CSV with a row count", async () => {
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();
    const { screen } = await setup();
    const menu = await openMenu(screen);
    await menu.getByRole("menuitem", { name: "Copy as CSV" }).click();
    await expect
      .element(screen.getByText("Copied 3 rows as CSV"))
      .toBeVisible();
    expect(String(writeText.mock.calls[0]?.[0])).toContain("\n");
    writeText.mockRestore();
  });

  it("copies the SQL with markers, never the values", async () => {
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();
    const { screen } = await setup();
    const menu = await openMenu(screen);
    await menu.getByRole("menuitem", { name: "Copy SQL" }).click();
    expect(writeText).toHaveBeenCalledWith("select … where region = $1");
    await expect.element(screen.getByText("Copied SQL")).toBeVisible();
    writeText.mockRestore();
  });

  it("deletes only after a second confirmation", async () => {
    const { calls, onClose, screen } = await setup();
    const menu = await openMenu(screen);
    await menu.getByRole("menuitem", { name: "Delete" }).click();
    expect(calls.deleteWidget).not.toHaveBeenCalled();
    await expect
      .element(menu.getByText("Press ↵ again to delete"))
      .toBeVisible();
    await menu
      .getByRole("menuitem", { name: "Press ↵ again to delete" })
      .click();
    await expect.poll(() => onClose.mock.calls.length).toBe(1);
    expect(calls.deleteWidget).toHaveBeenCalledWith({ widgetId: "w-revenue" });
  });

  it("opens the inputs editor with the widget as a draft", async () => {
    const { onEditInputs, screen } = await setup();
    const menu = await openMenu(screen);
    await menu.getByRole("menuitem", { name: "Edit Inputs" }).click();
    expect(onEditInputs).toHaveBeenCalledWith(
      expect.objectContaining({ id: "w-revenue", name: "Revenue by region" })
    );
  });

  it("renames inline", async () => {
    const { calls, screen } = await setup();
    const menu = await openMenu(screen);
    await menu.getByRole("menuitem", { name: "Rename" }).click();
    const field = screen.getByRole("textbox", { name: "Rename" });
    await field.fill("MRR by region");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => calls.saveWidget.mock.calls.length).toBe(1);
    expect(calls.saveWidget.mock.calls[0]?.[0]).toMatchObject({
      widget: { name: "MRR by region" },
    });
  });

  it("duplicates the widget without its id", async () => {
    const { calls, screen } = await setup();
    const menu = await openMenu(screen);
    await menu.getByRole("menuitem", { name: "Duplicate" }).click();
    await expect.poll(() => calls.saveWidget.mock.calls.length).toBe(1);
    const saved = calls.saveWidget.mock.calls[0]?.[0] as {
      widget: { id?: string; name: string };
    };
    expect(saved.widget.id).toBeUndefined();
    expect(saved.widget.name).toBe("Revenue by region copy");
  });

  it("cancels a running query with Escape", async () => {
    const run = deferred();
    const { calls, screen } = await setup({ runWidget: run.handler });
    await screen.getByRole("combobox", { name: "Region" }).click();
    await userEvent.keyboard("{Escape}{Escape}");
    await expect.poll(() => calls.cancelWidgetRun.mock.calls.length).toBe(1);
  });
});
