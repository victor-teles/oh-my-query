import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import type { DatabaseConnection } from "@/lib/connections";

import { engineAskStateAfter, fakeSession } from "@/test/ask-fixtures";
import { makeConnection } from "@/test/connection-fixture";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";

import type { AskState } from "./ask-reducer";
import type { AskSession } from "./use-ask";

import { AskView } from "./ask-view";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const shop = makeConnection({
  database: "shop",
  id: "mongodb",
  name: "shop",
  port: 27_017,
  type: "mongodb",
});
const cache = makeConnection({
  database: "0",
  id: "redis",
  name: "sessions-cache",
  port: 6379,
  type: "redis",
});

function Harness({ session }: { session: AskSession }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div data-testid="ask-harness" style={{ width: 760 }}>
      <AskView
        inputRef={inputRef}
        onAddToBoard={vi.fn()}
        onOpenSettings={vi.fn()}
        onReviewInputs={vi.fn()}
        onRunWidget={vi.fn()}
        session={session}
      />
    </div>
  );
}

const setup = async (state: AskState, connection: DatabaseConnection) => {
  const saveWidget = vi.fn();
  const proposeWidgetParams = vi.fn();
  const describeSql = vi.fn();
  const store = mockLauncherIpc({
    connections: [connection],
    handlers: { describeSql, proposeWidgetParams, saveWidget },
  });
  store.active = { connectionId: connection.id, database: null };
  renderWithConnections(<Harness session={fakeSession(state)} />);
  const screen = page.getByTestId("ask-harness");
  const input = screen.getByRole("textbox", { name: "Ask a question" });
  await expect.element(input).toBeVisible();
  return { input, proposeWidgetParams, saveWidget, screen };
};

const SAVE_UNAVAILABLE = "Saving works with SQL databases for now.";

const streamingPipeline = () =>
  engineAskStateAfter("orders by status", "mongodb", {
    nth: 12,
    type: "sqlDelta",
  });

describe.each([
  ["full motion", false],
  ["reduced motion", true],
])("asking MongoDB and Redis with %s", (_label, isReduced) => {
  it("streams a pipeline with the JSON highlighter and a caret", async () => {
    reduced.value = isReduced;
    const { screen } = await setup(streamingPipeline(), shop);
    const block = screen.getByRole("region", { name: "Generated pipeline" });

    await expect
      .element(screen.getByRole("heading", { name: "Generated pipeline" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("status"))
      .toHaveTextContent("Writing the pipeline");
    const caret = screen.getByTestId("sql-caret");
    await expect.element(caret).toBeVisible();
    expect(caret.element().classList.contains("ask-caret")).toBe(!isReduced);
    expect(block.element()).toMatchSnapshot();
  });

  it("underlines the refused Redis command", async () => {
    reduced.value = isReduced;
    const { screen } = await setup(
      engineAskStateAfter("set the checkout flag", "redis"),
      cache
    );
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("SET writes data; only read commands can run here.");
    const block = screen.getByRole("region", { name: "Generated commands" });
    const offending = block.getByText("SET", { exact: true });
    expect(offending.element().className).toContain("underline");
    expect(offending.element().className).toContain("text-chart-1");
    expect(block.element()).toMatchSnapshot();
  });

  it("explains that saving needs SQL instead of saving", async () => {
    reduced.value = isReduced;
    const { input, proposeWidgetParams, saveWidget, screen } = await setup(
      engineAskStateAfter("orders by status", "mongodb"),
      shop
    );
    await expect
      .element(screen.getByRole("heading", { name: "Orders by status" }))
      .toBeVisible();
    const hint = screen.getByText("Save", { exact: true });
    expect(hint.element().closest("[aria-disabled]")).not.toBeNull();

    await input.click();
    await userEvent.keyboard("{Meta>}s{/Meta}");
    const status = screen
      .getByRole("status")
      .filter({ hasText: SAVE_UNAVAILABLE });
    await expect.element(status).toBeVisible();
    expect(status.element()).toMatchSnapshot();
    expect(
      screen.getByRole("textbox", { name: "Widget name" }).query()
    ).toBeNull();
    expect(
      saveWidget.mock.calls.length + proposeWidgetParams.mock.calls.length
    ).toBe(0);
  });

  it("explains it for ⌘⇧S too, then returns to the connection status", async () => {
    reduced.value = isReduced;
    const { input, proposeWidgetParams, screen } = await setup(
      engineAskStateAfter("orders by status", "mongodb"),
      shop
    );
    await expect
      .element(screen.getByRole("heading", { name: "Orders by status" }))
      .toBeVisible();
    await input.click();
    await userEvent.keyboard("{Meta>}{Shift>}s{/Shift}{/Meta}");
    const status = screen
      .getByRole("status")
      .filter({ hasText: SAVE_UNAVAILABLE });
    await expect.element(status).toBeVisible();
    await expect.poll(() => status.query(), { timeout: 6000 }).toBeNull();
    expect(proposeWidgetParams).not.toHaveBeenCalled();
  }, 30_000);
});

describe("engine labels", () => {
  it("titles Redis commands and reads the result in the header", async () => {
    reduced.value = false;
    const { screen } = await setup(
      engineAskStateAfter("top 10 on the leaderboard", "redis"),
      cache
    );
    await expect
      .element(screen.getByRole("heading", { name: "Generated commands" }))
      .toBeVisible();
    await expect
      .element(
        screen.getByRole("heading", { name: "Top 10 on the leaderboard" })
      )
      .toBeVisible();
    await expect.element(screen.getByText("10 rows")).toBeVisible();
  });

  it("titles the pipeline before the first token arrives", async () => {
    reduced.value = false;
    const { screen } = await setup(
      engineAskStateAfter("orders by status", "mongodb", { type: "phase" }),
      shop
    );
    await expect
      .element(screen.getByRole("heading", { name: "Generated pipeline" }))
      .toBeVisible();
  });
});
