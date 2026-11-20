import { act, useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import type { LookupEvent, LookupHit } from "@/lib/ipc";

import { makeConnection } from "@/test/connection-fixture";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";

import type { LookupState } from "./lookup-reducer";
import type { LookupSession } from "./use-lookup";

import { initialLookupState, lookupReducer } from "./lookup-reducer";
import { LookupView } from "./lookup-view";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const UUID = "3f2a1b4c-9d8e-4f7a-b6c5-d4e3f2a1c91e";
const analytics = makeConnection({ id: "analytics", name: "analytics" });

const hit = (rank: number, table: string, matchedRows: number): LookupHit => ({
  capped: matchedRows > 100,
  column: rank === 0 ? "id" : "user_id",
  elapsedMs: 3,
  matchedRows: Math.min(matchedRows, 100),
  rank,
  schema: "public",
  table,
});

const PLANNED: LookupEvent = {
  probes: 14,
  skipped: { largeUnindexed: 0, outOfRange: 0, overLimit: 0 },
  tables: 14,
  type: "planned",
};
const HITS: LookupEvent[] = [
  { hit: hit(0, "users", 1), type: "hit" },
  { hit: hit(1, "orders", 12), type: "hit" },
  { hit: hit(2, "events", 101), type: "hit" },
];

const stateAfter = (events: LookupEvent[]): LookupState => {
  let state = lookupReducer(initialLookupState, {
    connectionId: "analytics",
    lookupId: "l1",
    type: "start",
    value: { kind: "uuid", value: UUID },
  });
  for (const event of events) {
    state = lookupReducer(state, { event, lookupId: "l1", type: "event" });
  }
  return state;
};

const STATES = {
  doneEmpty: stateAfter([
    { ...PLANNED, skipped: { largeUnindexed: 3, outOfRange: 0, overLimit: 0 } },
    { budgetExceeded: false, elapsedMs: 96, type: "done" },
  ]),
  doneHits: stateAfter([
    PLANNED,
    ...HITS,
    {
      column: "payload",
      reason: "timeout",
      table: "audit",
      type: "probeFailed",
    },
    { done: 14, total: 14, type: "progress" },
    { budgetExceeded: false, elapsedMs: 412, type: "done" },
  ]),
  error: stateAfter([
    {
      code: "UNSUPPORTED_ENGINE",
      message: "ID lookup isn't available for ClickHouse yet.",
      type: "error",
    },
  ]),
  planning: stateAfter([]),
  probing: stateAfter([
    PLANNED,
    HITS[0] as LookupEvent,
    { done: 4, total: 14, type: "progress" },
  ]),
  stopped: stateAfter([
    PLANNED,
    { done: 6, total: 14, type: "progress" },
    { code: "CANCELLED", message: "Stopped.", type: "error" },
  ]),
};

interface Controls {
  update: (state: LookupState) => void;
}

function Harness({
  session,
  onOpenRows,
  controls,
}: {
  session: LookupSession;
  onOpenRows: (hit: LookupHit) => void;
  controls: Controls;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState(session.state);
  controls.update = setState;
  return (
    <div data-testid="lookup-harness" style={{ width: 760 }}>
      <LookupView
        inputRef={inputRef}
        onOpenRows={onOpenRows}
        session={{ ...session, state }}
      />
    </div>
  );
}

const renderLookup = async (state: LookupState) => {
  const store = mockLauncherIpc({ connections: [analytics] });
  store.active = { connectionId: "analytics", database: null };
  const session = { cancel: vi.fn(), start: vi.fn(), state };
  const onOpenRows = vi.fn();
  const controls: Controls = { update: vi.fn() };
  const screen = renderWithConnections(
    <Harness controls={controls} onOpenRows={onOpenRows} session={session} />
  );
  await expect
    .element(page.getByRole("img", { name: "Active connection: analytics" }))
    .toBeVisible();
  return { controls, onOpenRows, screen, session };
};

const settledSwaps = async () => {
  await expect
    .poll(() => document.querySelector('[data-slot="swap-text"] > span + span'))
    .toBeNull();
};

const body = () => page.getByTestId("lookup-harness").element();

describe("lookupView states", () => {
  beforeEach(() => {
    reduced.value = true;
  });

  it.each(Object.entries(STATES))("renders %s", async (name, state) => {
    await renderLookup(state);
    await expect
      .element(page.getByRole("combobox", { name: "Looking up UUID" }))
      .toHaveValue(UUID);
    await settledSwaps();
    expect(body()).toMatchSnapshot(name);
  });

  it("says why nothing matched", async () => {
    await renderLookup(STATES.doneEmpty);
    await expect
      .element(page.getByText("No rows match 3f2a1b…c91e in 14 tables."))
      .toBeVisible();
    await expect
      .element(
        page.getByText("Skipped 3 large tables without an index on the column.")
      )
      .toBeVisible();
  });

  it("announces the final summary politely", async () => {
    const { screen } = await renderLookup(STATES.doneHits);
    const live = screen.container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe("Found in users, orders, and events");
    await expect
      .element(page.getByText("1 column didn't answer in time."))
      .toBeVisible();
  });

  it("shows a count of 100+ for a capped table", async () => {
    await renderLookup(STATES.doneHits);
    await expect
      .element(page.getByLabelText("100 or more rows"))
      .toHaveTextContent("100+");
  });
});

describe("lookupView keyboard", () => {
  let writeText: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    reduced.value = true;
    writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  });

  afterEach(() => {
    writeText.mockRestore();
  });

  it("moves with the arrows and opens rows with ↵", async () => {
    const { onOpenRows } = await renderLookup(STATES.doneHits);
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Enter}");
    expect(onOpenRows).toHaveBeenCalledWith(
      expect.objectContaining({ table: "orders" })
    );
  });

  it("opens rows on click", async () => {
    const { onOpenRows } = await renderLookup(STATES.doneHits);
    await page.getByRole("option", { name: /events/ }).click();
    expect(onOpenRows).toHaveBeenCalledWith(
      expect.objectContaining({ table: "events" })
    );
  });

  it("stops a running search on Esc and lets Esc through once stopped", async () => {
    const outer = vi.fn();
    window.addEventListener("keydown", outer);
    const { session } = await renderLookup(STATES.probing);
    await userEvent.keyboard("{Escape}");
    expect(session.cancel).toHaveBeenCalledOnce();
    expect(outer.mock.calls[0]?.[0]).toMatchObject({ defaultPrevented: true });
    window.removeEventListener("keydown", outer);
  });

  it("lets Esc pop the view when the search is over", async () => {
    const outer = vi.fn();
    window.addEventListener("keydown", outer);
    const { session } = await renderLookup(STATES.doneHits);
    await userEvent.keyboard("{Escape}");
    expect(session.cancel).not.toHaveBeenCalled();
    expect(outer.mock.calls[0]?.[0]).toMatchObject({ defaultPrevented: false });
    window.removeEventListener("keydown", outer);
  });

  it("copies the value with ⌘C", async () => {
    await renderLookup(STATES.doneHits);
    await userEvent.keyboard("{Meta>}c{/Meta}");
    expect(writeText).toHaveBeenCalledWith(UUID);
    await expect.element(page.getByText("Copied")).toBeVisible();
  });
});

describe.each([
  ["full motion", false, "spring"],
  ["reduced motion", true, "instant"],
])("lookupView motion with %s", (_label, isReduced, mode) => {
  beforeEach(() => {
    reduced.value = isReduced;
  });

  it("grows the progress hairline and removes it when done", async () => {
    const { controls } = await renderLookup(STATES.probing);
    const bar = page.getByRole("progressbar", { name: "Search progress" });
    await expect.element(bar).toHaveAttribute("aria-valuenow", "4");
    await expect.element(bar).toHaveAttribute("data-motion", mode);
    act(() => controls.update(STATES.doneHits));
    await expect.poll(() => bar.query()).toBeNull();
  });

  it("inserts arriving hits in rank order and swaps the status when done", async () => {
    const { controls } = await renderLookup(STATES.probing);
    await expect.element(page.getByText("Searching 14 tables…")).toBeVisible();
    act(() => controls.update(STATES.doneHits));
    await expect
      .element(page.getByText("Found in 3 tables · 412ms"))
      .toBeVisible();
    await expect
      .poll(() =>
        [...document.querySelectorAll('[role="option"]')].map(
          (option) => option.textContent
        )
      )
      .toStrictEqual([
        "usersidpublic1",
        "ordersuser_idpublic12",
        "eventsuser_idpublic100+",
      ]);
  });
});
