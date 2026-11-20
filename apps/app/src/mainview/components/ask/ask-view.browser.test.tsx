import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import {
  askStateAfter,
  REFUSED,
  REVENUE,
  withShownTurn,
} from "@/test/ask-fixtures";
import { renderAskView as renderAsk } from "@/test/ask-view-harness";
import { kpi } from "@/test/card-fixtures";

import type { AskState } from "./ask-reducer";

import { initialAskState } from "./ask-reducer";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const press = (keys: string) => userEvent.keyboard(keys);

describe.each([
  ["full motion", false],
  ["reduced motion", true],
])("askView with %s", (_label, isReduced) => {
  it("streams the SQL with the working state below it", async () => {
    reduced.value = isReduced;
    const { screen } = await renderAsk(
      askStateAfter(REVENUE, { nth: 20, type: "sqlDelta" })
    );
    await expect
      .element(screen.getByRole("status"))
      .toHaveTextContent("Writing SQL");
    await expect.element(screen.getByTestId("sql-caret")).toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: "Stop" }))
      .toBeVisible();
  });

  it("collapses the SQL and shows the card once answered", async () => {
    reduced.value = isReduced;
    const { screen } = await renderAsk(askStateAfter(REVENUE));
    await expect
      .element(
        screen.getByRole("heading", {
          name: "Monthly recurring revenue by region",
        })
      )
      .toBeVisible();
    expect(
      screen.getByRole("region", { name: "Generated SQL" }).query()
    ).toBeNull();
    await expect
      .element(screen.getByRole("img", { name: "Done" }))
      .toBeInTheDocument();
  });
});

describe("askView interactions", () => {
  it("refines with ↵ and asks a new question with ⌘↵", async () => {
    const { screen, session } = await renderAsk(askStateAfter(REVENUE));
    const input = screen.getByRole("textbox", { name: "Ask a question" });
    const target = { connectionId: "analytics", database: null };
    await input.fill("only Europe");
    await press("{Enter}");
    expect(session.refine).toHaveBeenCalledWith("only Europe", target);
    await input.fill("Revenue by plan");
    await press("{Meta>}{Enter}{/Meta}");
    expect(session.start).toHaveBeenCalledWith("Revenue by plan", target);
  });

  it("stops a working ask with Escape or the stop button", async () => {
    const { screen, session } = await renderAsk(
      askStateAfter(REVENUE, { nth: 5, type: "sqlDelta" })
    );
    await screen.getByRole("textbox", { name: "Ask a question" }).click();
    await press("{Escape}");
    await screen.getByRole("button", { name: "Stop" }).click();
    expect(session.cancel).toHaveBeenCalledTimes(2);
  });

  it("toggles the SQL with ⌘E and switches views with ⌘1–3", async () => {
    const { screen, session } = await renderAsk(askStateAfter(REVENUE));
    await screen.getByRole("textbox", { name: "Ask a question" }).click();
    await press("{Meta>}e{/Meta}");
    await press("{Meta>}3{/Meta}");
    expect(session.toggleSql).toHaveBeenCalledOnce();
    expect(session.selectView).toHaveBeenCalledWith("table");
  });

  it("copies the SQL with ⌘C when nothing is selected", async () => {
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();
    const { screen } = await renderAsk(askStateAfter(REVENUE));
    await screen.getByRole("button", { name: "Copy SQL" }).click();
    await press("{Meta>}c{/Meta}");
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(writeText.mock.calls[0]?.[0]).toContain(
      "-- Monthly recurring revenue by region"
    );
  });

  it("retries a failed query and opens settings for a missing provider", async () => {
    const failed: AskState = {
      ...askStateAfter(REVENUE, { type: "sqlDone" }),
      failure: {
        code: "QUERY_FAILED",
        message: "relation does not exist",
        phase: "run",
      },
      status: "error",
    };
    const { screen, session } = await renderAsk(failed);
    await screen.getByRole("button", { name: "Retry" }).click();
    expect(session.start).toHaveBeenCalledWith(REVENUE, {
      connectionId: "analytics",
      database: null,
    });

    const missing: AskState = {
      ...initialAskState,
      failure: { code: "NO_AI_SETTINGS", message: "x", phase: "schema" },
      prompt: REVENUE,
      status: "error",
    };
    const second = await renderAsk(missing);
    await second.screen.getByRole("button", { name: "Open Settings" }).click();
    expect(second.onOpenSettings).toHaveBeenCalledOnce();
  });
});

const withKpi = (): AskState =>
  withShownTurn(askStateAfter(REVENUE), {
    answer: { result: { ...kpi.result, executionTimeMs: 12 }, spec: kpi.spec },
    view: "kpi",
  });

describe("askView designed states", () => {
  it.each<[string, () => AskState, string]>([
    [
      "writing SQL",
      () => askStateAfter(REVENUE, { nth: 20, type: "sqlDelta" }),
      "Writing SQL",
    ],
    [
      "running",
      () => askStateAfter(REVENUE, { nth: 3, type: "phase" }),
      "Running query",
    ],
    [
      "the populated line card",
      () => askStateAfter(REVENUE),
      "Monthly recurring revenue by region",
    ],
    [
      "the table view",
      () => withShownTurn(askStateAfter(REVENUE), { view: "table" }),
      "Monthly recurring revenue by region",
    ],
    ["the KPI card", withKpi, "Total MRR"],
    [
      "the NOT_READ_ONLY error",
      () => askStateAfter(REFUSED),
      "This would change data",
    ],
    [
      "the NO_AI_SETTINGS error",
      () => ({
        ...initialAskState,
        failure: { code: "NO_AI_SETTINGS", message: "x", phase: "schema" },
        prompt: REVENUE,
        status: "error",
      }),
      "Add an AI provider",
    ],
  ])("matches the snapshot for %s", async (_label, state, marker) => {
    reduced.value = true;
    const { screen } = await renderAsk(state());
    await expect
      .element(screen.getByText(marker, { exact: false }).first())
      .toBeVisible();
    await expect
      .poll(() =>
        screen.element().querySelector('[data-slot="swap-text"] > span + span')
      )
      .toBeNull();
    expect(screen.element()).toMatchSnapshot();
  });
});
