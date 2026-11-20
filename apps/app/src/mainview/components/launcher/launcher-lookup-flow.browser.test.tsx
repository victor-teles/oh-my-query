import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import type { LookupEvent, RunSqlParams } from "@/lib/ipc";

import { AppProviders } from "@/components/app-providers";
import { resetSeenReveals } from "@/components/widgets/reveal-when-changed";
import { rawScriptFor } from "@/lib/browser-ask-stub";
import { DEMO_LOOKUP_UUID, lookupScriptFor } from "@/lib/browser-lookup-stub";
import { makeConnection } from "@/test/connection-fixture";
import { emitIpcMessage } from "@/test/ipc-mock";
import { mockLauncherIpc } from "@/test/launcher-ipc";

import { LauncherPanel } from "./launcher-panel";

const reduced = vi.hoisted(() => ({ value: true }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const analytics = makeConnection({ id: "analytics", name: "analytics" });
const UUID = { kind: "uuid", value: DEMO_LOOKUP_UUID } as const;
const EMAIL = { kind: "email", value: "ada@example.com" } as const;

interface LookupCall {
  lookupId: string;
  value: unknown;
}

const setup = () => {
  const lookups: LookupCall[] = [];
  const cancelled: unknown[] = [];
  const runs: RunSqlParams[] = [];
  mockLauncherIpc({
    connections: [analytics],
    handlers: {
      cancelLookup: (payload) => {
        cancelled.push(payload.lookupId);
        return null;
      },
      getActiveConnection: () => ({
        connectionId: "analytics",
        database: null,
      }),
      lookup: (payload) => {
        lookups.push(payload as unknown as LookupCall);
        return null;
      },
      runSql: (payload) => {
        runs.push(payload as unknown as RunSqlParams);
        return null;
      },
    },
  });
  render(
    <AppProviders>
      <LauncherPanel />
    </AppProviders>
  );
  return { cancelled, lookups, runs };
};

const replayLookup = (lookupId: string, events: LookupEvent[]) => {
  for (const event of events) {
    emitIpcMessage("lookupEvent", { event, lookupId });
  }
};

const hitRows = () =>
  [...document.querySelectorAll('#lookup-results [role="option"]')].map(
    (option) => option.textContent
  );

const scriptEvents = () => lookupScriptFor(UUID).map(([, event]) => event);

const search = () => page.getByRole("combobox", { name: "Search commands" });
const findRow = () => page.getByRole("option", { name: /Find 3f2a1b…c91e/ });

const startLookup = async () => {
  const calls = setup();
  await search().fill(DEMO_LOOKUP_UUID);
  await expect.element(findRow()).toBeVisible();
  await userEvent.keyboard("{Enter}");
  await expect.poll(() => calls.lookups.length).toBe(1);
  return { ...calls, lookupId: calls.lookups[0]?.lookupId ?? "" };
};

describe("looking up an id from the launcher", () => {
  beforeEach(() => {
    reduced.value = true;
    resetSeenReveals();
  });

  it("puts the Find row first for a pasted UUID", async () => {
    setup();
    await search().fill(DEMO_LOOKUP_UUID);
    await expect.element(findRow()).toBeVisible();
    const options = document.querySelectorAll('[role="option"]');
    expect(options[0]?.textContent).toContain("Find3f2a1b…c91ein analytics");
    expect(document.querySelector("footer")?.textContent).toContain("Find");
  });

  it("streams hits in rank order and ends with a summary", async () => {
    const { lookupId, lookups } = await startLookup();
    expect(lookups[0]?.value).toStrictEqual(UUID);
    replayLookup(lookupId, scriptEvents());
    await expect.element(page.getByText(/Found in 3 tables/)).toBeVisible();
    await expect
      .poll(hitRows)
      .toStrictEqual([
        "usersidpublic1",
        "ordersuser_idpublic12",
        "eventsactor_idpublic100+",
      ]);
  });

  it("opens a table's matching rows and comes back to intact results", async () => {
    const { lookupId, runs } = await startLookup();
    replayLookup(lookupId, scriptEvents());
    await expect.element(page.getByText(/Found in 3 tables/)).toBeVisible();
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => runs.length).toBe(1);
    const [run] = runs;
    expect(run?.source).toStrictEqual({
      column: "user_id",
      kind: "match",
      schema: "public",
      table: "orders",
      value: UUID,
    });
    for (const [, event] of rawScriptFor(run as RunSqlParams)) {
      emitIpcMessage("askEvent", { askId: run?.askId, event });
    }
    await expect.element(page.getByText("Matching rows")).toBeVisible();
    await expect
      .element(page.getByRole("heading", { name: "Orders · user_id" }))
      .toBeVisible();

    await userEvent.keyboard("{Meta>}s{/Meta}");
    expect(
      page.getByRole("textbox", { name: "Widget name" }).query()
    ).toBeNull();
    expect(page.getByText("Save", { exact: true }).query()).toBeNull();

    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByText(/Found in 3 tables/)).toBeVisible();
    await expect.poll(() => hitRows().length).toBe(3);
  });

  it("stops a running lookup on Esc, then goes back on the next Esc", async () => {
    const { cancelled, lookupId } = await startLookup();
    replayLookup(lookupId, scriptEvents().slice(0, 3));
    await expect.element(page.getByText("Searching 14 tables…")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    expect(cancelled).toStrictEqual([lookupId]);
    await expect
      .element(page.getByText(/^Stopped · 1 of 14 columns$/))
      .toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(search()).toBeVisible();
  });
});

describe("clipboard offer", () => {
  beforeEach(() => {
    reduced.value = true;
    resetSeenReveals();
  });

  const clipboardRow = () =>
    page.getByRole("option", { name: /from your clipboard/ });

  it("offers a copied email on summon and runs nothing until ↵", async () => {
    const { lookups } = setup();
    await expect.element(search()).toBeVisible();
    emitIpcMessage("launcherShown", { clipboard: EMAIL });
    await expect.element(page.getByText("From clipboard")).toBeVisible();
    await expect.element(clipboardRow()).toBeVisible();
    expect(lookups).toHaveLength(0);

    await clipboardRow().click();
    await expect.poll(() => lookups[0]?.value).toStrictEqual(EMAIL);
  });

  it("hides the offer while typing and brings it back on an empty query", async () => {
    setup();
    await expect.element(search()).toBeVisible();
    emitIpcMessage("launcherShown", { clipboard: EMAIL });
    await expect.element(clipboardRow()).toBeVisible();
    await search().fill("rev");
    await expect.poll(() => clipboardRow().query()).toBeNull();
    await search().fill("");
    await expect.element(clipboardRow()).toBeVisible();
  });

  it("forgets the offer once the launcher hides", async () => {
    setup();
    await expect.element(search()).toBeVisible();
    emitIpcMessage("launcherShown", { clipboard: EMAIL });
    await expect.element(clipboardRow()).toBeVisible();
    emitIpcMessage("launcherDismiss");
    await expect.poll(() => clipboardRow().query()).toBeNull();
    emitIpcMessage("launcherShown", { clipboard: null });
    await expect.element(search()).toBeVisible();
    expect(clipboardRow().query()).toBeNull();
  });

  it("shows nothing when the summon carries no offer", async () => {
    setup();
    await expect.element(search()).toBeVisible();
    emitIpcMessage("launcherShown", { clipboard: null });
    expect(page.getByText("From clipboard").query()).toBeNull();
  });
});

describe.each([
  ["full motion", false, "fade"],
  ["reduced motion", true, "instant"],
])("lookup row entrance with %s", (_label, isReduced, mode) => {
  beforeEach(() => {
    reduced.value = isReduced;
    resetSeenReveals();
  });

  it("enters at its section position", async () => {
    setup();
    await search().fill(DEMO_LOOKUP_UUID);
    await expect.element(findRow()).toBeVisible();
    const group = findRow().element().closest<HTMLElement>("[data-motion]");
    expect(group?.dataset.motion).toBe(mode);
  });

  it("reveals the clipboard offer", async () => {
    setup();
    await expect.element(search()).toBeVisible();
    emitIpcMessage("launcherShown", { clipboard: UUID });
    await expect
      .element(page.getByRole("option", { name: /from your clipboard/ }))
      .toBeVisible();
  });
});
