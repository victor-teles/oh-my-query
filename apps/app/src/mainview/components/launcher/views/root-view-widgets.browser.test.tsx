import { useEffect, useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import type { RecentAsk, Widget } from "@/lib/ipc";

import { optionId } from "@/components/launcher/launcher-row";
import { resetSeenReveals } from "@/components/widgets/reveal-when-changed";
import { useWidgets } from "@/components/widgets/widgets-provider";
import { makeConnection } from "@/test/connection-fixture";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";
import { makeRecent, makeWidget } from "@/test/widget-fixtures";

import { RootView } from "./root-view";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const analytics = makeConnection({ id: "analytics", name: "analytics" });

interface HarnessProps {
  runWidget: (widgetId: string, values: Record<string, unknown>) => void;
  startAsk: (prompt: string, target: unknown) => void;
  fresh?: string;
}

function MarkFresh({ widgetId }: { widgetId: string }) {
  const { markFresh } = useWidgets();
  useEffect(() => {
    markFresh(widgetId);
  }, [markFresh, widgetId]);
  return null;
}

function Harness({ runWidget, startAsk, fresh }: HarnessProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div style={{ width: 760 }}>
      {fresh ? <MarkFresh widgetId={fresh} /> : null}
      <RootView
        ask={{ reopen: null, start: startAsk, startSql: vi.fn() }}
        inputRef={inputRef}
        lookup={{ offer: null, start: vi.fn() }}
        navigate={{
          addToBoard: vi.fn(),
          dismiss: vi.fn(),
          editConnection: vi.fn(),
          newBoard: vi.fn(),
          openBoard: vi.fn(),
          openHistory: vi.fn(),
          openSettings: vi.fn(),
          renameBoard: vi.fn(),
          runWidget,
        }}
        onQueryChange={setQuery}
        query={query}
      />
    </div>
  );
}

const setup = async ({
  widgets = [makeWidget()],
  recents = [] as RecentAsk[],
  fresh,
}: { widgets?: Widget[]; recents?: RecentAsk[]; fresh?: string } = {}) => {
  const store = mockLauncherIpc({
    connections: [analytics],
    handlers: {
      ask: vi.fn(),
      listRecentAsks: () => recents,
      listWidgets: () => widgets,
      proposeWidgetParams: vi.fn(),
    },
  });
  store.active = { connectionId: "analytics", database: null };
  const runWidget = vi.fn();
  const startAsk = vi.fn();
  const screen = renderWithConnections(
    <Harness fresh={fresh} runWidget={runWidget} startAsk={startAsk} />
  );
  const search = screen.getByRole("combobox", { name: "Search commands" });
  await expect
    .element(screen.getByRole("option", { name: /Revenue by region/ }))
    .toBeVisible();
  return { runWidget, screen, search, startAsk };
};

const widgetOption = optionId("widget-w-revenue");

describe.each([
  ["full motion", false],
  ["reduced motion", true],
])("widgets in the root list with %s", (_label, isReduced) => {
  beforeEach(() => {
    reduced.value = isReduced;
    resetSeenReveals();
  });

  it("lists recent asks and widgets with their current inputs", async () => {
    const { screen } = await setup({ recents: [makeRecent()] });
    await expect
      .element(screen.getByRole("group", { name: "Recent" }))
      .toHaveTextContent("Revenue for Europe");
    await expect
      .element(screen.getByRole("option", { name: /Revenue by region/ }))
      .toHaveTextContent("Europe · Last quarter");
    expect(
      screen.getByRole("listbox", { name: "Results" }).element()
    ).toMatchSnapshot();
  });

  it("selects a just-saved widget", async () => {
    const { search } = await setup({ fresh: "w-revenue" });
    await expect
      .element(search)
      .toHaveAttribute("aria-activedescendant", widgetOption);
  });

  it("shows argument pills on Tab and cycles them with Tab and ⇧Tab", async () => {
    const { screen, search } = await setup();
    await search.click();
    await expect
      .element(search)
      .toHaveAttribute("aria-activedescendant", widgetOption);
    await userEvent.keyboard("{Tab}");

    const region = screen.getByRole("combobox", { name: "Region" });
    await expect.element(region).toHaveFocus();
    await expect
      .element(screen.getByRole("heading", { name: "Revenue by region" }))
      .toBeVisible();
    expect(
      screen.getByRole("group", { name: "Revenue by region inputs" }).element()
    ).toMatchSnapshot();

    await userEvent.keyboard("{Tab}");
    await expect
      .element(screen.getByRole("button", { name: /^Period:/ }))
      .toHaveFocus();
    await userEvent.keyboard("{Tab}");
    await expect.element(region).toHaveFocus();
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    await expect
      .element(screen.getByRole("button", { name: /^Period:/ }))
      .toHaveFocus();
  });
});

describe("fresh widget pulse", () => {
  beforeEach(() => {
    resetSeenReveals();
  });

  it("pulses a just-saved widget once with full motion", async () => {
    reduced.value = false;
    const { screen } = await setup({ fresh: "w-revenue" });
    await expect.element(screen.getByTestId("fresh-pulse")).toBeInTheDocument();
    await expect
      .poll(() => screen.getByTestId("fresh-pulse").query(), { timeout: 3000 })
      .toBeNull();
  });

  it("skips the pulse with reduced motion", async () => {
    reduced.value = true;
    const { screen, search } = await setup({ fresh: "w-revenue" });
    await expect
      .element(search)
      .toHaveAttribute("aria-activedescendant", widgetOption);
    expect(screen.getByTestId("fresh-pulse").query()).toBeNull();
  });
});

describe("root widget interactions", () => {
  beforeEach(() => {
    reduced.value = false;
    resetSeenReveals();
  });

  it("runs the selected widget with its last values on Enter", async () => {
    const { runWidget, search } = await setup();
    await search.click();
    await userEvent.keyboard("{Enter}");
    expect(runWidget).toHaveBeenCalledWith("w-revenue", {});
  });

  it("picks a value with the type-ahead and runs with it", async () => {
    const { runWidget, screen, search } = await setup();
    await search.click();
    await userEvent.keyboard("{Tab}");
    const region = screen.getByRole("combobox", { name: "Region" });
    await region.fill("amer");
    const options = screen.getByRole("listbox", { name: "Region options" });
    await expect
      .element(options.getByRole("option"))
      .toHaveTextContent("North America");
    await userEvent.keyboard("{Enter}");
    expect(runWidget).toHaveBeenCalledWith("w-revenue", {
      period: "lastQuarter",
      region: "North America",
    });
  });

  it("steps through date presets with the arrow keys", async () => {
    const { runWidget, screen, search } = await setup();
    await search.click();
    await userEvent.keyboard("{Tab}{Tab}");
    const presets = screen.getByRole("listbox", { name: "Period presets" });
    await expect.element(presets).toBeVisible();
    await expect
      .element(presets.getByRole("option", { name: "Last quarter" }))
      .toHaveAttribute("aria-selected", "true");
    expect(presets.element()).toMatchSnapshot();
    await userEvent.keyboard("{ArrowDown}");
    await expect
      .element(presets.getByRole("option", { name: "Year to date" }))
      .toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Enter}");
    expect(runWidget).toHaveBeenCalledWith("w-revenue", {
      period: "ytd",
      region: "Europe",
    });
  });

  it("commits a preset on click", async () => {
    const { runWidget, screen, search } = await setup();
    await search.click();
    await userEvent.keyboard("{Tab}{Tab}");
    await screen.getByRole("option", { name: "This month" }).click();
    expect(runWidget).toHaveBeenCalledWith("w-revenue", {
      period: "thisMonth",
      region: "Europe",
    });
  });

  it("commits a custom date range typed in the popover", async () => {
    const { runWidget, screen, search } = await setup();
    await search.click();
    await userEvent.keyboard("{Tab}{Tab}");
    await screen
      .getByRole("textbox", { name: "Period from" })
      .fill("2026-01-01");
    await screen
      .getByRole("textbox", { name: "Period through" })
      .fill("2026-03-31");
    await userEvent.keyboard("{Enter}");
    expect(runWidget).toHaveBeenCalledWith("w-revenue", {
      period: { from: "2026-01-01", to: "2026-04-01" },
      region: "Europe",
    });
  });

  it("closes a dropdown with Escape before leaving the inputs", async () => {
    const { screen, search } = await setup();
    await search.click();
    await userEvent.keyboard("{Tab}");
    await expect
      .element(screen.getByRole("listbox", { name: "Region options" }))
      .toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect
      .poll(() =>
        screen.getByRole("listbox", { name: "Region options" }).query()
      )
      .toBeNull();
    await userEvent.keyboard("{Escape}");
    await expect
      .element(screen.getByRole("combobox", { name: "Search commands" }))
      .toHaveFocus();
  });

  it("edits text and number inputs inline", async () => {
    const widget = makeWidget({
      params: [
        { default: "acme", label: "Account", name: "account", type: "text" },
        {
          default: 10,
          label: "Limit",
          max: 100,
          min: 1,
          name: "row_limit",
          type: "number",
        },
      ],
      sqlTemplate: "select * from t where a = {{account}} limit {{row_limit}}",
    });
    const { runWidget, screen, search } = await setup({ widgets: [widget] });
    await search.click();
    await userEvent.keyboard("{Tab}");
    await screen.getByRole("textbox", { name: "Account" }).fill("globex");
    await userEvent.keyboard("{Tab}");
    const limit = screen.getByRole("textbox", { name: "Limit" });
    await limit.fill("25x");
    await expect.element(limit).toHaveValue("10");
    await limit.fill("25");
    await userEvent.keyboard("{Enter}");
    expect(runWidget).toHaveBeenCalledWith("w-revenue", {
      account: "globex",
      row_limit: 25,
    });
  });

  it("picks a single date from presets or types one", async () => {
    const widget = makeWidget({
      params: [{ default: "today", label: "Day", name: "day", type: "date" }],
      sqlTemplate: "select * from orders where placed_on = {{day}}",
    });
    const { runWidget, screen, search } = await setup({ widgets: [widget] });
    await search.click();
    await userEvent.keyboard("{Tab}");
    await expect
      .element(screen.getByRole("button", { name: "Day: Today" }))
      .toHaveFocus();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(runWidget).toHaveBeenLastCalledWith("w-revenue", {
      day: "yesterday",
    });

    await screen.getByRole("textbox", { name: "Day date" }).fill("2026-02-14");
    await userEvent.keyboard("{Enter}");
    expect(runWidget).toHaveBeenLastCalledWith("w-revenue", {
      day: "2026-02-14",
    });
  });

  it("asks a recent question again", async () => {
    const { search, startAsk } = await setup({ recents: [makeRecent()] });
    await search.click();
    await userEvent.keyboard("{Enter}");
    expect(startAsk).toHaveBeenCalledWith("Revenue for Europe", {
      connectionId: "analytics",
      database: null,
    });
  });

  it("doesn't replay the recent reveal when nothing changed", async () => {
    const first = await setup({ recents: [makeRecent()] });
    first.screen.unmount();
    const { screen } = await setup({ recents: [makeRecent()] });
    await expect
      .element(screen.getByRole("group", { name: "Recent" }))
      .toBeVisible();
  });
});
