import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import type { ImportPreview, ImportResult } from "@/lib/ipc";

import {
  LOCAL_CONNECTIONS,
  makeBundle,
  makeImportResult,
  makePlan,
} from "@/test/bundle-fixtures";
import { makeConnection } from "@/test/connection-fixture";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";
import { checksDrawn } from "@/test/wait";

import { ImportView } from "./import-view";

const ready = (plan = makePlan()): ImportPreview => ({
  bundle: makeBundle(),
  plan,
  status: "ready",
});

const REGION_FROM_SQL = {
  default: "Europe",
  label: "Region",
  name: "region",
  optionsSql: "select distinct region from revenue",
  type: "select" as const,
};

const bundleWithOptionsQuery = () => {
  const bundle = makeBundle();
  const [first, ...rest] = bundle.widgets;
  return {
    ...bundle,
    widgets: first ? [{ ...first, params: [REGION_FROM_SQL] }, ...rest] : rest,
  };
};

interface SetupOptions {
  preview?: () => unknown;
  apply?: () => unknown;
  connections?: typeof LOCAL_CONNECTIONS;
}

const setup = ({
  preview = () => ready(),
  apply = () => makeImportResult(),
  connections = LOCAL_CONNECTIONS,
}: SetupOptions = {}) => {
  const ipc = {
    applyImport: vi.fn(apply),
    previewImport: vi.fn(preview),
  };
  mockLauncherIpc({ connections, handlers: ipc });
  const props = { onBack: vi.fn(), onDone: vi.fn() };
  const screen = renderWithConnections(
    <div style={{ width: 760 }}>
      <ImportView {...props} />
    </div>
  );
  return { ipc, props, screen };
};

type Screen = ReturnType<typeof setup>["screen"];

const openReview = async (screen: Screen) => {
  await screen.getByRole("button", { name: /From Clipboard/ }).click();
  await expect
    .element(screen.getByRole("radiogroup", { name: "analytics · PostgreSQL" }))
    .toHaveFocus();
  await expect
    .element(screen.getByRole("group", { name: "Import from" }))
    .not.toBeInTheDocument();
};

const widgetBox = (screen: Screen, name: RegExp) =>
  screen.getByRole("checkbox", { name });

describe("importView sources", () => {
  it("offers the clipboard and a file, focusing the clipboard first", async () => {
    const { screen } = setup();
    await expect
      .element(screen.getByRole("button", { name: /From Clipboard/ }))
      .toHaveFocus();
    await expect
      .element(screen.getByRole("button", { name: /From File…/ }))
      .toBeVisible();
    expect(screen.container).toMatchSnapshot();
  });

  it("moves between sources with the arrow keys and reads the file on Enter", async () => {
    const { ipc, screen } = setup({ preview: () => ({ status: "cancelled" }) });
    await expect
      .element(screen.getByRole("button", { name: /From Clipboard/ }))
      .toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    await expect
      .element(screen.getByRole("button", { name: /From File…/ }))
      .toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => ipc.previewImport.mock.calls.length).toBe(1);
    expect(ipc.previewImport).toHaveBeenCalledWith({ source: "file" });
    await expect
      .element(screen.getByRole("button", { name: /From File…/ }))
      .toBeVisible();
  });

  it("shows a reading hairline when the read takes a while", async () => {
    const pending = Promise.withResolvers<ImportPreview>();
    const { screen } = setup({ preview: () => pending.promise });
    await screen.getByRole("button", { name: /From File…/ }).click();
    await expect.element(screen.getByTestId("run-progress")).toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: /From File…/ }))
      .toHaveAttribute("aria-busy", "true");
    expect(screen.container).toMatchSnapshot();
    pending.resolve({ status: "cancelled" });
  });

  it("explains an empty clipboard", async () => {
    const { screen } = setup({
      preview: () => ({
        message: "The clipboard has no oh-my-query export.",
        status: "invalid",
      }),
    });
    await screen.getByRole("button", { name: /From Clipboard/ }).click();
    const alert = screen.getByRole("alert");
    await expect
      .element(alert)
      .toHaveTextContent("The clipboard has no oh-my-query export.");
    expect(screen.container).toMatchSnapshot();
  });

  it("names the first invalid field of a file", async () => {
    const { screen } = setup({
      preview: () => ({
        message:
          "widgets[2].sqlTemplate: Too small: expected string to have >=1 characters",
        status: "invalid",
      }),
    });
    await screen.getByRole("button", { name: /From File…/ }).click();
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("widgets[2].sqlTemplate");
    expect(screen.container).toMatchSnapshot();
  });
});

describe("importView review", () => {
  it("maps connections by name, leaves duplicates off and disables an unmapped connection's widgets", async () => {
    const { screen } = setup();
    await openReview(screen);
    await expect.element(widgetBox(screen, /Revenue by region/)).toBeChecked();
    const signups = widgetBox(screen, /Weekly signups/);
    await expect.element(signups).not.toBeChecked();
    await expect.element(signups).toHaveAccessibleName(/Already here/);
    const clicks = widgetBox(screen, /Clicks today/);
    await expect.element(clicks).toHaveAttribute("aria-disabled", "true");
    await expect.element(clicks).toHaveAccessibleName(/Choose a connection/);
    await expect
      .element(screen.getByText("Import 1 widget, 1 board"))
      .toBeVisible();
    expect(screen.container).toMatchSnapshot();
  });

  it("shows every widget on when each connection has a match", async () => {
    const connections = [
      ...LOCAL_CONNECTIONS,
      makeConnection({ id: "conn-ch", name: "warehouse", type: "clickhouse" }),
    ];
    const { screen } = setup({
      connections,
      preview: () => ready(makePlan(makeBundle(), [], connections)),
    });
    await openReview(screen);
    await expect.element(widgetBox(screen, /Clicks today/)).toBeChecked();
    await expect
      .element(screen.getByText("Import 3 widgets, 1 board"))
      .toBeVisible();
    expect(screen.container).toMatchSnapshot();
  });

  it("remaps a connection with the arrow keys", async () => {
    const { screen } = setup();
    await openReview(screen);
    const group = screen.getByRole("radiogroup", {
      name: "analytics · PostgreSQL",
    });
    await userEvent.keyboard("{ArrowRight}");
    await expect
      .element(group.getByRole("radio", { name: /staging/ }))
      .toHaveAttribute("aria-checked", "true");
    await expect
      .element(widgetBox(screen, /Weekly signups/))
      .not.toHaveAccessibleName(/Already here/);
    await userEvent.keyboard("{ArrowRight}");
    await expect
      .element(group.getByRole("radio", { name: "Skip" }))
      .toHaveAttribute("aria-checked", "true");
    await expect
      .element(widgetBox(screen, /Revenue by region/))
      .toHaveAccessibleName(/Choose a connection/);
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    await expect
      .element(group.getByRole("radio", { name: /analytics/ }))
      .toHaveAttribute("aria-checked", "true");
  });

  it("remaps a connection by clicking a chip", async () => {
    const { screen } = setup();
    await openReview(screen);
    await screen.getByRole("radio", { name: /staging/ }).click();
    await expect
      .element(screen.getByRole("radio", { name: /staging/ }))
      .toHaveAttribute("aria-checked", "true");
  });

  it("toggles a widget with Space and updates the footer count", async () => {
    const { screen } = setup();
    await openReview(screen);
    await userEvent.keyboard("{ArrowDown}");
    await expect
      .element(
        screen.getByRole("radiogroup", { name: "warehouse · ClickHouse" })
      )
      .toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    await expect.element(widgetBox(screen, /Revenue by region/)).toHaveFocus();
    await userEvent.keyboard(" ");
    await expect
      .element(widgetBox(screen, /Revenue by region/))
      .not.toBeChecked();
    await expect.element(screen.getByText("Nothing selected")).toBeVisible();
    await userEvent.keyboard("{ArrowDown} ");
    await expect.element(widgetBox(screen, /Weekly signups/)).toBeChecked();
    await expect
      .element(screen.getByText("Import 1 widget, 1 board"))
      .toBeVisible();
  });

  it("ignores Space on a widget without a connection", async () => {
    const { screen } = setup();
    await openReview(screen);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}");
    await expect.element(widgetBox(screen, /Clicks today/)).toHaveFocus();
    await userEvent.keyboard(" ");
    await expect.element(widgetBox(screen, /Clicks today/)).not.toBeChecked();
  });

  it("turns boards off with their toggle", async () => {
    const { screen } = setup();
    await openReview(screen);
    await screen.getByText("Import boards").click();
    await expect
      .element(screen.getByRole("checkbox", { name: /Import boards/ }))
      .not.toBeChecked();
    await expect.element(screen.getByText("Import 1 widget")).toBeVisible();
  });

  it("shows a select input's options query with the widget's SQL", async () => {
    const { screen } = setup({
      preview: () => ({
        bundle: bundleWithOptionsQuery(),
        plan: makePlan(),
        status: "ready",
      }),
    });
    await openReview(screen);
    await screen
      .getByRole("button", { name: "Show SQL for Revenue by region" })
      .click();
    await expect
      .element(
        screen.getByRole("region", {
          name: "Region options for Revenue by region",
        })
      )
      .toHaveTextContent("select distinct region from revenue");
  });

  it("imports the exact map and skips with ⌘↵", async () => {
    const { ipc, screen } = setup();
    await openReview(screen);
    await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    await expect.poll(() => ipc.applyImport.mock.calls.length).toBe(1);
    expect(ipc.applyImport).toHaveBeenCalledWith({
      boards: true,
      bundle: makeBundle(),
      connectionMap: { c1: "conn-staging", c2: null },
      skipWidgetRefs: ["w2"],
    });
  });
});

describe("importView results", () => {
  const failedResult: ImportResult = makeImportResult({
    failed: [
      {
        kind: "widget",
        name: "Weekly signups",
        reason: "Its SQL would change data, so it wasn't imported.",
        ref: "w2",
      },
    ],
    skipped: [
      {
        kind: "widget",
        name: "Clicks today",
        reason: "No connection chosen",
        ref: "w3",
      },
    ],
  });

  it("shows Importing… while a slow import runs", async () => {
    const pending = Promise.withResolvers<ImportResult>();
    const { screen } = setup({ apply: () => pending.promise });
    await openReview(screen);
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    await expect.element(screen.getByText("Importing…")).toBeVisible();
    expect(screen.container).toMatchSnapshot();
    pending.resolve(makeImportResult());
    await expect
      .element(screen.getByRole("button", { name: "Done" }))
      .toBeVisible();
  });

  it("lists what failed and what was skipped", async () => {
    const { screen } = setup({ apply: () => failedResult });
    await openReview(screen);
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    const failed = screen.getByRole("region", { name: "Didn't import" });
    await expect.element(failed).toHaveTextContent("Weekly signups");
    await expect.element(failed).toHaveTextContent("would change data");
    await expect
      .element(screen.getByRole("region", { name: "Skipped" }))
      .toHaveTextContent("No connection chosen");
    await expect.poll(() => checksDrawn(screen.container)).toBe(true);
    expect(screen.container).toMatchSnapshot();
  });

  it("finishes on Enter with the first imported widget", async () => {
    const { props, screen } = setup();
    await openReview(screen);
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    await expect
      .element(screen.getByText("Imported 1 widget and 1 board."))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Done" }))
      .toHaveFocus();
    await expect.poll(() => checksDrawn(screen.container)).toBe(true);
    expect(screen.container).toMatchSnapshot();
    await userEvent.keyboard("{Enter}");
    expect(props.onDone).toHaveBeenCalledWith("new-revenue");
  });

  it("keeps the review after a failed import and retries", async () => {
    const { ipc, screen } = setup({
      apply: () => {
        throw new Error("Lost the connection.");
      },
    });
    await openReview(screen);
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("Lost the connection.");
    ipc.applyImport.mockImplementationOnce(() => makeImportResult());
    await screen.getByRole("button", { name: "Retry" }).click();
    await expect
      .element(screen.getByRole("button", { name: "Done" }))
      .toBeVisible();
  });

  it("goes back with the header button", async () => {
    const { props, screen } = setup();
    await screen.getByRole("button", { name: "Back" }).click();
    expect(props.onBack).toHaveBeenCalledOnce();
  });
});
