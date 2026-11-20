import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import type { DatabaseConnection } from "@/lib/connections";
import type { RecentAsk } from "@/lib/ipc";

import { optionId } from "@/components/launcher/launcher-row";
import { makeConnection } from "@/test/connection-fixture";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";
import { makeRecent, makeWidget } from "@/test/widget-fixtures";

import type { HistoryAskActions } from "./use-history-commands";

import { HistoryView } from "./history-view";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const NOW = new Date(2026, 10, 19, 15, 0);
const local = (day: number, hours: number, minutes = 0) =>
  new Date(2026, 10, day, hours, minutes).toISOString();

const analytics = makeConnection({ id: "analytics", name: "analytics" });

const SIGNUPS = makeRecent({
  askedAt: local(19, 14, 5),
  id: "a-signups",
  prompt: "Signups by plan, EU only",
  spec: { ...makeRecent().spec, title: "Signups by plan" },
  sql: "select plan, count(*) from signups where region = 'EU' group by 1",
});
const REVENUE = makeRecent({
  askedAt: local(19, 9, 30),
  database: "sales",
  id: "a-revenue",
  prompt: "Revenue for Europe",
  sql: "select sum(mrr) from billing_events",
});
const CHURN = makeRecent({
  askedAt: local(18, 17, 45),
  connectionId: "warehouse",
  id: "a-churn",
  prompt: "Churned accounts last month",
  sql: "select * from accounts where churned_at is not null",
});
const ASKS = [SIGNUPS, REVENUE, CHURN];

function Harness({ ask }: { ask: HistoryAskActions }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div data-testid="history-harness" style={{ width: 760 }}>
      <HistoryView ask={ask} inputRef={inputRef} />
    </div>
  );
}

interface SetupOptions {
  asks?: RecentAsk[] | (() => unknown);
  connections?: DatabaseConnection[];
  handlers?: Record<string, (payload: Record<string, unknown>) => unknown>;
}

const setup = ({
  asks = ASKS,
  connections = [analytics],
  handlers = {},
}: SetupOptions = {}) => {
  const ipc = {
    clearRecentAsks: vi.fn(() => null),
    deleteRecentAsk: vi.fn(() => null),
    listRecentAsks: vi.fn(typeof asks === "function" ? asks : () => asks),
    saveWidget: vi.fn((payload: Record<string, unknown>) => ({
      ...makeWidget(),
      ...(payload.widget as object),
      id: "w-saved",
    })),
    ...handlers,
  };
  const store = mockLauncherIpc({ connections, handlers: ipc });
  store.active =
    connections.length > 0
      ? { connectionId: "analytics", database: null }
      : null;
  const ask = { start: vi.fn(), startSql: vi.fn() };
  renderWithConnections(<Harness ask={ask} />);
  const screen = page.getByTestId("history-harness");
  return {
    ask,
    input: screen.getByRole("combobox", { name: "Search history" }),
    ipc,
    screen,
  };
};

const ready = async (screen: ReturnType<typeof setup>["screen"]) => {
  await expect
    .element(screen.getByRole("option", { name: /Signups by plan/ }))
    .toBeVisible();
};

describe("historyView", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    reduced.value = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks for every stored ask and groups them by day", async () => {
    const { ipc, screen } = setup();
    await ready(screen);
    expect(ipc.listRecentAsks).toHaveBeenCalledWith({});
    await expect
      .element(screen.getByRole("group", { name: "Today" }))
      .toHaveTextContent(
        "Signups by plan, EU onlyanalytics · Signups by plan · 14:05"
      );
    await expect
      .element(screen.getByRole("group", { name: "Yesterday" }))
      .toHaveTextContent("connection removed · Monthly recurring revenue");
    expect(
      screen.getByRole("listbox", { name: "Past asks" }).element()
    ).toMatchSnapshot();
  });

  it("filters to Matches, highlights the prompt and announces the count", async () => {
    const { input, screen } = setup();
    await ready(screen);
    await input.fill("billing");
    await expect.poll(() => screen.getByRole("option").all().length).toBe(1);
    await expect
      .element(screen.getByRole("group", { name: "Matches" }))
      .toHaveTextContent("Revenue for Europe");
    await expect
      .element(screen.getByRole("status").first())
      .toHaveTextContent("1 ask matches");

    await input.fill("sign");
    const option = screen.getByRole("option", { name: /Signups/ });
    await expect.element(option).toBeVisible();
    const strong = [
      ...option.element().querySelectorAll("span.font-medium"),
    ].map((span) => span.textContent);
    expect(strong.join("")).toBe("Sign");
  });

  it("says when nothing matches", async () => {
    const { input, screen } = setup();
    await ready(screen);
    await input.fill("zzzz");
    const message = screen.getByText("Nothing matches “zzzz”");
    await expect.element(message).toBeVisible();
    expect(message.element().parentElement).toMatchSnapshot();
  });

  it("asks again on the stored connection and database", async () => {
    const { ask, screen } = setup();
    await ready(screen);
    await userEvent.keyboard("{ArrowDown}");
    await expect
      .element(page.getByText("Ask again", { exact: true }))
      .toBeVisible();
    await userEvent.keyboard("{Enter}");
    expect(ask.start).toHaveBeenCalledWith("Revenue for Europe", {
      connectionId: "analytics",
      database: "sales",
    });
  });

  it("falls back to the active connection when the stored one is gone", async () => {
    const { ask, input, screen } = setup();
    await ready(screen);
    await userEvent.keyboard("{ArrowUp}");
    await expect
      .element(input)
      .toHaveAttribute("aria-activedescendant", optionId("a-churn"));
    await expect.element(page.getByText("Ask on analytics")).toBeVisible();
    await screen.getByRole("option", { name: /Churned accounts/ }).click();
    expect(ask.start).toHaveBeenCalledWith("Churned accounts last month", {
      connectionId: "analytics",
      database: null,
    });
  });

  it("explains that asking needs a connection", async () => {
    const { ask, screen } = setup({ connections: [] });
    await ready(screen);
    await expect
      .element(page.getByText("Add a connection to ask again"))
      .toBeVisible();
    await userEvent.keyboard("{Enter}");
    expect(ask.start).not.toHaveBeenCalled();
  });

  it("copies the SQL with ⌘C", async () => {
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();
    const { screen } = setup();
    await ready(screen);
    await userEvent.keyboard("{Meta>}c{/Meta}");
    expect(writeText).toHaveBeenCalledWith(SIGNUPS.sql);
    await expect.element(page.getByText("Copied SQL")).toBeVisible();
    writeText.mockRestore();
  });

  it("saves the stored SQL as a widget with ⌘S", async () => {
    const { ipc, screen } = setup();
    await ready(screen);
    await userEvent.keyboard("{Meta>}s{/Meta}");
    const name = screen.getByRole("textbox", { name: "Widget name" });
    await expect.element(name).toHaveValue("Signups by plan");
    await name.fill("Plans in the EU");
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByText("Saved · in Widgets")).toBeVisible();
    expect(ipc.saveWidget).toHaveBeenCalledWith({
      widget: expect.objectContaining({
        connectionId: "analytics",
        name: "Plans in the EU",
        prompt: SIGNUPS.prompt,
        sqlTemplate: SIGNUPS.sql,
        view: "line",
      }),
    });
  });

  it("shows the save error in the footer", async () => {
    const { screen } = setup({
      handlers: {
        saveWidget: () => {
          throw new Error("Only read-only queries can be saved.");
        },
      },
    });
    await ready(screen);
    await userEvent.keyboard("{Meta>}s{/Meta}");
    await userEvent.keyboard("{Enter}");
    await expect
      .element(page.getByText("Only read-only queries can be saved."))
      .toBeVisible();
  });

  it("shows an error with Retry", async () => {
    const listRecentAsks = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("disk unreadable");
      })
      .mockReturnValue(ASKS);
    const { screen } = setup({ handlers: { listRecentAsks } });
    const alert = screen.getByRole("alert");
    await expect.element(alert).toHaveTextContent("History couldn’t load.");
    expect(alert.element().parentElement).toMatchSnapshot();
    await screen.getByRole("button", { name: "Retry" }).click();
    await ready(screen);
    expect(listRecentAsks).toHaveBeenLastCalledWith({});
  });

  it("says when there is no history yet", async () => {
    const { screen } = setup({ asks: [] });
    const message = screen.getByText("No asks yet.");
    await expect.element(message).toBeVisible();
    expect(message.element().parentElement).toMatchSnapshot();
  });

  it("opens the actions menu with ⌘K", async () => {
    const { screen } = setup();
    await ready(screen);
    await userEvent.keyboard("{Meta>}k{/Meta}");
    const menu = page.getByRole("menu", {
      name: "Actions for Signups by plan, EU only",
    });
    await expect.element(menu).toBeVisible();
    await expect
      .element(menu.getByRole("menuitem", { name: /Run SQL \(no AI\)/ }))
      .toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(menu).not.toBeInTheDocument();
  });

  it("runs the stored SQL without the AI from the menu", async () => {
    const { ask, screen } = setup();
    await ready(screen);
    await userEvent.keyboard("{Meta>}k{/Meta}");
    await page.getByRole("menuitem", { name: /Run SQL/ }).click();
    expect(ask.startSql).toHaveBeenCalledWith(SIGNUPS.sql, {
      connectionId: "analytics",
      database: null,
    });
  });

  it("copies the prompt from the menu", async () => {
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();
    const { screen } = setup();
    await ready(screen);
    await userEvent.keyboard("{Meta>}k{/Meta}");
    await page.getByRole("menuitem", { name: /Copy Prompt/ }).click();
    expect(writeText).toHaveBeenCalledWith(SIGNUPS.prompt);
    writeText.mockRestore();
  });
});

describe.each([
  ["full motion", false, "stagger"],
  ["reduced motion", true, "instant"],
])("history motion with %s", (_label, isReduced, intro) => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    reduced.value = isReduced;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("staggers the first rows in once and never on re-filter", async () => {
    const { input, screen } = setup();
    await ready(screen);
    const motionOf = (name: RegExp) =>
      screen.getByRole("option", { name }).element().parentElement?.dataset
        .motion;
    expect(motionOf(/Signups/)).toBe(intro);
    await input.fill("churn");
    await expect.poll(() => motionOf(/Churned/)).toBe("instant");
  });

  it("removes one ask with ⌃X and moves the selection to the next row", async () => {
    const { input, ipc, screen } = setup();
    await ready(screen);
    await userEvent.keyboard("{Control>}x{/Control}");
    await expect
      .element(screen.getByRole("option", { name: /Signups/ }))
      .not.toBeInTheDocument();
    expect(ipc.deleteRecentAsk).toHaveBeenCalledWith({ askId: "a-signups" });
    await expect
      .element(input)
      .toHaveAttribute("aria-activedescendant", optionId("a-revenue"));
    await expect.element(page.getByText("Removed from history")).toBeVisible();
  });

  it("keeps a slow load's skeleton up until the asks arrive", async () => {
    const pending = Promise.withResolvers<RecentAsk[]>();
    const { screen } = setup({ asks: () => pending.promise });
    const skeleton = screen.getByTestId("history-skeleton");
    await expect.element(skeleton).toBeVisible();
    expect(skeleton.element()).toMatchSnapshot();
    pending.resolve(ASKS);
    await ready(screen);
    await expect.element(skeleton).not.toBeInTheDocument();
  });

  it("clears every ask only after a second press", async () => {
    const { ipc, screen } = setup();
    await ready(screen);
    await userEvent.keyboard("{Meta>}k{/Meta}");
    const clear = page.getByRole("menuitem", { name: /Clear History/ });
    await clear.click();
    expect(ipc.clearRecentAsks).not.toHaveBeenCalled();
    await expect.element(clear).toHaveTextContent("Press ↵ again to delete");
    await clear.click();
    expect(ipc.clearRecentAsks).toHaveBeenCalledOnce();
    await expect.element(screen.getByText("No asks yet.")).toBeVisible();
    await expect.element(page.getByText("History cleared")).toBeVisible();
  });
});
