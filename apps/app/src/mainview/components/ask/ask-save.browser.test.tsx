import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import type { WidgetDraft } from "@/lib/ipc";

import { askStateAfter, fakeSession, REVENUE } from "@/test/ask-fixtures";
import { makeConnection } from "@/test/connection-fixture";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";
import { makeWidget } from "@/test/widget-fixtures";

import type { AskSession } from "./use-ask";

import { AskView } from "./ask-view";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const analytics = makeConnection({ id: "analytics", name: "analytics" });

interface HarnessProps {
  session: AskSession;
  onReviewInputs: (draft: WidgetDraft) => void;
  onRunWidget: (widgetId: string) => void;
  onAddToBoard?: (widgetId: string) => void;
}

function Harness({
  session,
  onReviewInputs,
  onRunWidget,
  onAddToBoard = vi.fn(),
}: HarnessProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div data-testid="ask-harness" style={{ width: 760 }}>
      <AskView
        inputRef={inputRef}
        onAddToBoard={onAddToBoard}
        onOpenSettings={vi.fn()}
        onReviewInputs={onReviewInputs}
        onRunWidget={onRunWidget}
        session={session}
      />
    </div>
  );
}

const setup = async (
  handlers: Record<string, (payload: Record<string, unknown>) => unknown> = {}
) => {
  const saveWidget = vi.fn((payload: Record<string, unknown>) => ({
    ...makeWidget(),
    ...(payload.widget as object),
    id: "w-saved",
  }));
  const store = mockLauncherIpc({
    connections: [analytics],
    handlers: { saveWidget, ...handlers },
  });
  store.active = { connectionId: "analytics", database: null };
  const onReviewInputs = vi.fn();
  const onRunWidget = vi.fn();
  renderWithConnections(
    <Harness
      onReviewInputs={onReviewInputs}
      onRunWidget={onRunWidget}
      session={fakeSession(askStateAfter(REVENUE))}
    />
  );
  const screen = page.getByTestId("ask-harness");
  const input = screen.getByRole("textbox", { name: "Ask a question" });
  await expect
    .element(
      screen.getByRole("heading", {
        name: "Monthly recurring revenue by region",
      })
    )
    .toBeVisible();
  await input.click();
  return { input, onReviewInputs, onRunWidget, saveWidget, screen };
};

describe.each([
  ["full motion", false],
  ["reduced motion", true],
])("saving an answer with %s", (_label, isReduced) => {
  it("names and saves a widget with ⌘S, then runs it with ⌥⏎", async () => {
    reduced.value = isReduced;
    const { input, onRunWidget, saveWidget, screen } = await setup();
    await userEvent.keyboard("{Meta>}s{/Meta}");
    const name = screen.getByRole("textbox", { name: "Widget name" });
    await expect
      .element(name)
      .toHaveValue("Monthly recurring revenue by region");
    await expect.element(name).toHaveFocus();
    expect(name.element().closest("label")).toMatchSnapshot();

    await name.fill("MRR by region");
    await userEvent.keyboard("{Enter}");
    await expect.element(screen.getByText("Saved · ⌥⏎ to run")).toBeVisible();
    await expect.element(input).toHaveFocus();
    expect(saveWidget.mock.calls[0]?.[0]).toMatchObject({
      widget: {
        connectionId: "analytics",
        name: "MRR by region",
        params: [],
        sqlTemplate: expect.stringContaining("select"),
        view: "line",
      },
    });

    await userEvent.keyboard("{Alt>}{Enter}{/Alt}");
    expect(onRunWidget).toHaveBeenCalledWith("w-saved");
  });

  it("finds inputs with ⌘⇧S and opens the review", async () => {
    reduced.value = isReduced;
    const proposal = {
      params: makeWidget().params,
      template: makeWidget().sqlTemplate,
    };
    const reply = Promise.withResolvers<typeof proposal>();
    const { onReviewInputs, screen } = await setup({
      proposeWidgetParams: () => reply.promise,
    });
    await userEvent.keyboard("{Meta>}{Shift>}s{/Shift}{/Meta}");
    await expect.element(screen.getByText("Finding inputs…")).toBeVisible();
    reply.resolve(proposal);
    await expect.poll(() => onReviewInputs.mock.calls.length).toBe(1);
    expect(onReviewInputs.mock.calls[0]?.[0]).toMatchObject({
      name: "Monthly recurring revenue by region",
      params: proposal.params,
      sqlTemplate: proposal.template,
    });
  });
});

describe("saving failures", () => {
  it("falls back to a plain save when no inputs can be found", async () => {
    reduced.value = false;
    const { screen } = await setup({
      proposeWidgetParams: () => ({
        error: "The template changes more than literal values.",
      }),
    });
    await userEvent.keyboard("{Meta>}{Shift>}s{/Shift}{/Meta}");
    await expect
      .element(
        screen
          .getByRole("status")
          .filter({ hasText: "⌘S saves without inputs" })
      )
      .toHaveTextContent(
        "The template changes more than literal values. ⌘S saves without inputs."
      );
  });

  it("reports a failed save", async () => {
    const { screen } = await setup({
      saveWidget: () => {
        throw new Error("Disk is full.");
      },
    });
    await userEvent.keyboard("{Meta>}s{/Meta}");
    await userEvent.keyboard("{Enter}");
    await expect
      .element(screen.getByRole("status").filter({ hasText: "Disk is full." }))
      .toBeVisible();
  });

  it("cancels naming with Escape and keeps the ask open", async () => {
    const { input, saveWidget, screen } = await setup();
    await userEvent.keyboard("{Meta>}s{/Meta}");
    await userEvent.keyboard("{Escape}");
    await expect
      .poll(() => screen.getByRole("textbox", { name: "Widget name" }).query())
      .toBeNull();
    await expect.element(input).toHaveFocus();
    expect(saveWidget).not.toHaveBeenCalled();
  });
});
