import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { fakeSession, rawStateAfter } from "@/test/ask-fixtures";
import { makeConnection } from "@/test/connection-fixture";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";
import { makeWidget } from "@/test/widget-fixtures";

import type { AskState } from "./ask-reducer";
import type { AskSession } from "./use-ask";

import { askReducer, initialAskState } from "./ask-reducer";
import { AskView } from "./ask-view";

const analytics = makeConnection({ id: "analytics", name: "analytics" });
const SQL = "select region, mrr from revenue";
const TARGET = { connectionId: "analytics", database: null };

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

const setup = async (state: AskState) => {
  const saveWidget = vi.fn((payload: Record<string, unknown>) => ({
    ...makeWidget(),
    ...(payload.widget as object),
    id: "w-raw",
  }));
  const store = mockLauncherIpc({
    connections: [analytics],
    handlers: { saveWidget },
  });
  store.active = { connectionId: "analytics", database: null };
  const session = fakeSession(state);
  renderWithConnections(<Harness session={session} />);
  const screen = page.getByTestId("ask-harness");
  const input = screen.getByRole("textbox", { name: "Ask a question" });
  await expect.element(input).toBeVisible();
  return { input, saveWidget, screen, session };
};

describe("ask view for raw SQL", () => {
  it("labels the SQL as yours and offers to run it again", async () => {
    const { input, screen } = await setup(rawStateAfter(SQL));
    await expect.element(screen.getByText("Your SQL")).toBeVisible();
    await expect.element(input).toHaveValue(`> ${SQL}`);
    await expect.element(screen.getByText("Run again")).toBeVisible();
    expect(screen.getByText("Generated SQL").query()).toBeNull();
  });

  it("never says it is writing SQL while running", async () => {
    const running = askReducer(initialAskState, {
      askId: "r1",
      prompt: SQL,
      source: "sql",
      type: "start",
    });
    const { screen } = await setup(running);
    await expect
      .element(screen.getByText("Running query").first())
      .toBeVisible();
    expect(screen.getByText("Writing SQL").query()).toBeNull();
  });

  it("explains a refused write in launcher terms", async () => {
    const { screen } = await setup(rawStateAfter("delete from orders"));
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent(
        "This would change data. The launcher only runs read-only queries."
      );
    expect(screen.getByRole("alert").element()).toMatchSnapshot();
  });

  it("re-runs an edited > draft as SQL and anything else as a question", async () => {
    const { input, session } = await setup(rawStateAfter(SQL));
    await input.fill("> select 2");
    await userEvent.keyboard("{Enter}");
    expect(session.startSql).toHaveBeenCalledWith("select 2", TARGET);

    await input.fill("revenue by region");
    await userEvent.keyboard("{Enter}");
    expect(session.start).toHaveBeenCalledWith("revenue by region", TARGET);
  });

  it("saves a raw query as a widget with no prompt", async () => {
    const { input, saveWidget, screen } = await setup(rawStateAfter(SQL));
    await input.click();
    await userEvent.keyboard("{Meta>}s{/Meta}");
    await screen
      .getByRole("textbox", { name: "Widget name" })
      .fill("Raw revenue");
    await userEvent.keyboard("{Enter}");
    await expect.element(screen.getByText("Saved · ⌥⏎ to run")).toBeVisible();
    expect(saveWidget.mock.calls[0]?.[0]).toMatchObject({
      widget: { name: "Raw revenue", prompt: "", sqlTemplate: SQL },
    });
  });
});
