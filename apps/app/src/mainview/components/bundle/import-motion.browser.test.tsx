import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import {
  LOCAL_CONNECTIONS,
  makeBundle,
  makeImportResult,
  makePlan,
} from "@/test/bundle-fixtures";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";

import { ImportView } from "./import-view";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const setup = () => {
  mockLauncherIpc({
    connections: LOCAL_CONNECTIONS,
    handlers: {
      applyImport: () => makeImportResult(),
      previewImport: () => ({
        bundle: makeBundle(),
        plan: makePlan(),
        status: "ready",
      }),
    },
  });
  return renderWithConnections(
    <div style={{ width: 760 }}>
      <ImportView onBack={vi.fn()} onDone={vi.fn()} />
    </div>
  );
};

const settledOpacity = (element: Element | null | undefined) =>
  element instanceof HTMLElement ? element.style.opacity : null;

describe.each([
  ["full motion", false],
  ["reduced motion", true],
])("import review with %s", (_label, isReduced) => {
  it("staggers the review rows in and settles them fully visible", async () => {
    reduced.value = isReduced;
    const screen = setup();
    await screen.getByRole("button", { name: /From Clipboard/ }).click();
    const row = screen.getByRole("radiogroup", {
      name: "analytics · PostgreSQL",
    });
    await expect.element(row).toBeVisible();
    await expect
      .poll(() => settledOpacity(row.element().parentElement))
      .toBe("1");
    await expect
      .element(screen.getByRole("checkbox", { name: /Clicks today/ }))
      .toBeInTheDocument();
  });

  it("expands a widget's SQL with ⌘E and collapses it on repeat", async () => {
    reduced.value = isReduced;
    const screen = setup();
    await screen.getByRole("button", { name: /From Clipboard/ }).click();
    await expect
      .element(
        screen.getByRole("radiogroup", { name: "analytics · PostgreSQL" })
      )
      .toHaveFocus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    await userEvent.keyboard("{Meta>}e{/Meta}");
    const sql = screen.getByRole("region", {
      name: "SQL for Revenue by region",
    });
    await expect.element(sql).toHaveTextContent("from revenue");
    await expect
      .element(
        screen.getByRole("button", { name: "Hide SQL for Revenue by region" })
      )
      .toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{Meta>}e{/Meta}");
    await expect
      .poll(() =>
        screen
          .getByRole("region", { name: "SQL for Revenue by region" })
          .query()
      )
      .toBeNull();
  });

  it("shows SQL from the row's button too", async () => {
    reduced.value = isReduced;
    const screen = setup();
    await screen.getByRole("button", { name: /From Clipboard/ }).click();
    await screen
      .getByRole("button", { name: "Show SQL for Clicks today" })
      .click();
    await expect
      .element(screen.getByRole("region", { name: "SQL for Clicks today" }))
      .toHaveTextContent("from clicks");
  });
});
