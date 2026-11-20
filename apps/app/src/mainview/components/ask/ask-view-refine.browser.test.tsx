import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import type { AskParams } from "@/lib/ipc";

import { AppProviders } from "@/components/app-providers";
import { LauncherPanel } from "@/components/launcher/launcher-panel";
import { askScriptFor } from "@/lib/browser-ask-stub";
import { recordedAssumptions } from "@/lib/browser-refine-stub";
import { REVENUE } from "@/test/ask-fixtures";
import { makeConnection } from "@/test/connection-fixture";
import { emitIpcMessage } from "@/test/ipc-mock";
import { mockLauncherIpc } from "@/test/launcher-ipc";

const reduced = vi.hoisted(() => ({ value: true }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const analytics = makeConnection({ id: "analytics", name: "analytics" });
const BASE_TITLE = "Monthly recurring revenue by region";
const EUROPE_TITLE = "Monthly recurring revenue in Europe";

const setup = () => {
  const saved: Record<string, unknown>[] = [];
  const proposed: Record<string, unknown>[] = [];
  const asked: AskParams[] = [];
  const cancelled: string[] = [];
  const described: string[] = [];
  mockLauncherIpc({
    connections: [analytics],
    handlers: {
      ask: (payload) => {
        asked.push(payload as unknown as AskParams);
        return null;
      },
      cancelAsk: (payload) => {
        cancelled.push(String(payload.askId));
        return null;
      },
      describeSql: (payload) => {
        described.push(String(payload.sql));
        return recordedAssumptions(String(payload.sql));
      },
      getActiveConnection: () => ({
        connectionId: "analytics",
        database: null,
      }),
      getAiSettings: () => ({
        baseUrl: null,
        hasKey: true,
        keyHint: "abcd",
        model: null,
        provider: "anthropic",
      }),
      proposeWidgetParams: (payload) => {
        proposed.push(payload);
        return { error: "Nothing to turn into inputs." };
      },
      saveWidget: (payload) => {
        saved.push(payload);
        return { ...(payload.widget as object), createdAt: "", id: "w1" };
      },
    },
  });
  render(
    <AppProviders>
      <LauncherPanel />
    </AppProviders>
  );
  return { asked, cancelled, described, proposed, saved };
};

const replay = (params: AskParams | undefined, count?: number) => {
  const steps = askScriptFor(
    params ?? { askId: "", connectionId: "", database: null, prompt: "" },
    "analytics"
  );
  for (const [, event] of steps.slice(0, count)) {
    emitIpcMessage("askEvent", { askId: params?.askId ?? "", event });
  }
};

const input = () => page.getByRole("textbox", { name: "Ask a question" });
const heading = (name: string) => page.getByRole("heading", { name });
const shownCard = () =>
  document.querySelector('[data-testid="answer-stage"] section');

const askFirst = async (asked: AskParams[]) => {
  await page.getByRole("combobox", { name: "Search commands" }).fill(REVENUE);
  await userEvent.keyboard("{Enter}");
  await expect.poll(() => asked.length).toBe(1);
  replay(asked[0]);
  await expect.element(heading(BASE_TITLE)).toBeVisible();
};

const refine = async (asked: AskParams[], text: string) => {
  const before = asked.length;
  await input().fill(text);
  await userEvent.keyboard("{Enter}");
  await expect.poll(() => asked.length).toBe(before + 1);
  return asked[before];
};

describe.each([
  ["full motion", false],
  ["reduced motion", true],
])("refining an answer with %s", (_label, isReduced) => {
  beforeEach(() => {
    reduced.value = isReduced;
  });

  it("keeps the same card element while it dims and morphs to the refine", async () => {
    const { asked } = setup();
    await askFirst(asked);
    const card = shownCard();
    await expect.element(input()).toHaveValue("");

    const sent = await refine(asked, "only Europe");
    expect(sent?.refine).toMatchObject({
      chainId: asked[0]?.askId,
      sql: expect.stringContaining("by region"),
      turns: [REVENUE],
    });
    await expect.element(input()).toHaveValue("");
    await expect.element(page.getByTestId("run-progress")).toBeInTheDocument();
    await expect
      .element(page.getByTestId("answer-stage"))
      .toHaveAttribute("aria-busy", "true");
    expect(shownCard()).toBe(card);

    replay(sent);
    await expect.element(heading(EUROPE_TITLE)).toBeVisible();
    expect(shownCard()).toBe(card);
    await expect
      .poll(() => page.getByTestId("run-progress").query())
      .toBeNull();
    const trail = page.getByRole("navigation", { name: "Question steps" });
    await expect
      .element(trail.getByRole("button", { name: /Show step 2: only Europe/ }))
      .toHaveAttribute("aria-current", "step");
  });

  it("steps through turns with ↑ and ↓ on an empty input", async () => {
    const { asked } = setup();
    await askFirst(asked);
    replay(await refine(asked, "only Europe"));
    await expect.element(heading(EUROPE_TITLE)).toBeVisible();

    await userEvent.keyboard("{ArrowUp}");
    await expect.element(heading(BASE_TITLE)).toBeVisible();
    await expect
      .element(page.getByText(`Step 1 of 2: ${REVENUE}`))
      .toBeInTheDocument();
    await userEvent.keyboard("{ArrowDown}");
    await expect.element(heading(EUROPE_TITLE)).toBeVisible();

    await userEvent.keyboard("{Escape}");
    const search = page.getByRole("combobox", { name: "Search commands" });
    await expect.element(search).toBeVisible();
    await search.fill("");
    await userEvent.keyboard("{ArrowUp}");
    await expect.element(heading(EUROPE_TITLE)).toBeVisible();
    expect(asked).toHaveLength(2);
  });

  it("puts the shown answer back when a refine is stopped", async () => {
    const { asked, cancelled } = setup();
    await askFirst(asked);
    const sent = await refine(asked, "by quarter");
    replay(sent, 6);

    await userEvent.keyboard("{Escape}");
    await expect.poll(() => cancelled).toStrictEqual([sent?.askId]);
    await expect.element(heading(BASE_TITLE)).toBeVisible();
    await expect
      .poll(() => page.getByTestId("run-progress").query())
      .toBeNull();
    await expect
      .element(page.getByRole("textbox", { name: "Ask a question" }))
      .toBeVisible();
  });
});

describe("refine input", () => {
  beforeEach(() => {
    reduced.value = true;
  });

  it("asks a fresh question with ⌘↵", async () => {
    const { asked } = setup();
    await askFirst(asked);
    await input().fill("Weekly signups by plan");
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    await expect.poll(() => asked.length).toBe(2);
    expect(asked[1]?.refine).toBeUndefined();
  });

  it("switches the view for a phrase like 'as a table' without asking", async () => {
    const { asked } = setup();
    await askFirst(asked);
    await input().fill("as a table");
    await userEvent.keyboard("{Enter}");
    await expect
      .element(page.getByRole("radio", { name: "Table" }))
      .toHaveAttribute("aria-checked", "true");
    expect(asked).toHaveLength(1);
  });

  it("shows a failed refine above the answer it kept and retries it", async () => {
    const { asked } = setup();
    await askFirst(asked);
    const sent = await refine(asked, "only paid plans");
    emitIpcMessage("askEvent", {
      askId: sent?.askId,
      event: {
        code: "QUERY_FAILED",
        message: 'column "plan" does not exist',
        phase: "run",
        type: "error",
      },
    });
    await expect.element(page.getByText("The query failed.")).toBeVisible();
    await expect.element(heading(BASE_TITLE)).toBeVisible();
    await expect.element(input()).toHaveValue("only paid plans");

    await page.getByRole("button", { name: "Retry" }).click();
    await expect.poll(() => asked.length).toBe(3);
    expect(asked[2]).toMatchObject({
      prompt: "only paid plans",
      refine: { turns: [REVENUE] },
    });
  });

  it("stops at six turns and points to ⌘↵", async () => {
    const { asked } = setup();
    await askFirst(asked);
    for (const text of [
      "by week",
      "by month",
      "sorted desc",
      "top five",
      "last year",
    ]) {
      replay(await refine(asked, text));
      await expect
        .element(
          page.getByRole("button", {
            name: `Show step ${asked.length}: ${text}`,
          })
        )
        .toHaveAttribute("aria-current", "step");
    }
    await expect
      .element(input())
      .toHaveAttribute("aria-placeholder", "Start a new question with ⌘↵");
    await input().fill("one more");
    await userEvent.keyboard("{Enter}");
    expect(asked).toHaveLength(6);
    await expect.element(page.getByText("New question")).toBeVisible();
  });
});

describe("assumptions and drill-down", () => {
  beforeEach(() => {
    reduced.value = true;
  });

  it("describes the SQL without asking and pre-fills from a chip", async () => {
    const { asked, described } = setup();
    await askFirst(asked);
    const line = page.getByRole("list", { name: "Assumptions" });
    await expect
      .element(line.getByText("subscriptions, accounts, regions"))
      .toBeVisible();
    expect(described).toHaveLength(1);

    await line
      .getByRole("button", { name: "Group by week instead of month" })
      .click();
    await expect
      .element(input())
      .toHaveValue("group by week instead of by month");
    await expect.element(input()).toHaveFocus();
    const field = input().element() as HTMLInputElement;
    expect([field.selectionStart, field.selectionEnd]).toStrictEqual([9, 13]);
    await expect
      .element(
        page.getByText("Ready to refine: group by week instead of by month")
      )
      .toBeInTheDocument();
    expect(asked).toHaveLength(1);
  });

  it("pre-fills a drill from a table row and from the ⌘D list", async () => {
    const { asked } = setup();
    await askFirst(asked);
    await page.getByRole("radio", { name: "Table" }).click();
    await page.getByRole("row").nth(1).click();
    await expect
      .element(input())
      .toHaveValue('break down month "Jan 2026", region "North America"');

    await input().fill("");
    await userEvent.keyboard("{Meta>}d{/Meta}");
    const list = page.getByRole("menu", { name: "Drill into…" });
    await expect.element(list).toBeVisible();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect
      .element(input())
      .toHaveValue('break down month "Jan 2026", region "Europe"');
    expect(asked).toHaveLength(1);
  });
});

describe("saving a refined answer", () => {
  beforeEach(() => {
    reduced.value = true;
  });

  it("saves the chain prompt with the refined SQL, card and view", async () => {
    const { asked, proposed, saved } = setup();
    await askFirst(asked);
    replay(await refine(asked, "only Europe"));
    await expect.element(heading(EUROPE_TITLE)).toBeVisible();

    await userEvent.keyboard("{Meta>}{Shift>}s{/Shift}{/Meta}");
    await expect.poll(() => proposed.length).toBe(1);
    expect(proposed[0]).toMatchObject({
      prompt: `${REVENUE} · only Europe`,
      sql: expect.stringContaining("r.name = 'Europe'"),
    });

    await userEvent.keyboard("{Meta>}s{/Meta}");
    await expect
      .element(page.getByRole("textbox", { name: "Widget name" }))
      .toHaveValue(EUROPE_TITLE);
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => saved.length).toBe(1);
    expect(saved[0]).toMatchObject({
      widget: {
        prompt: `${REVENUE} · only Europe`,
        spec: { title: EUROPE_TITLE },
        sqlTemplate: expect.stringContaining("r.name = 'Europe'"),
        view: "line",
      },
    });
  });
});
