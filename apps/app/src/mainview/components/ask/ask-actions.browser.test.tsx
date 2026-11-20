import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import {
  askStateAfter,
  fakeSession,
  REFUSED,
  REVENUE,
  withShownTurn,
} from "@/test/ask-fixtures";
import { makeConnection } from "@/test/connection-fixture";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";
import { makeWidget } from "@/test/widget-fixtures";

import type { AskState } from "./ask-reducer";

import { AskView } from "./ask-view";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const analytics = makeConnection({ id: "analytics", name: "analytics" });
const TITLE = "Monthly recurring revenue by region";
const answered = askStateAfter(REVENUE);

interface HarnessProps {
  state: AskState;
  onAddToBoard: (widgetId: string) => void;
}

function Harness({ state, onAddToBoard }: HarnessProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div data-testid="ask-harness" style={{ width: 760 }}>
      <AskView
        inputRef={inputRef}
        onAddToBoard={onAddToBoard}
        onOpenSettings={vi.fn()}
        onReviewInputs={vi.fn()}
        onRunWidget={vi.fn()}
        session={fakeSession(state)}
      />
    </div>
  );
}

type Handler = (payload: Record<string, unknown>) => unknown;

const setup = async (
  state: AskState = answered,
  handlers: Record<string, Handler> = {}
) => {
  const ipc = {
    copyImage: vi.fn<Handler>(() => null),
    revealSaved: vi.fn<Handler>(() => null),
    saveToDownloads: vi.fn<Handler>((payload) => ({
      fileName: `${String(payload.baseName)}.csv`,
      savedId: "saved-1",
    })),
    saveWidget: vi.fn<Handler>((payload) => ({
      ...makeWidget(),
      ...(payload.widget as object),
      id: "w-saved",
    })),
    ...handlers,
  };
  const store = mockLauncherIpc({ connections: [analytics], handlers: ipc });
  store.active = { connectionId: "analytics", database: null };
  const onAddToBoard = vi.fn();
  renderWithConnections(<Harness onAddToBoard={onAddToBoard} state={state} />);
  const screen = page.getByTestId("ask-harness");
  const input = screen.getByRole("textbox", { name: "Ask a question" });
  await expect.element(input).toBeVisible();
  await input.click();
  return { input, ipc, onAddToBoard, screen };
};

const openMenu = async (screen: ReturnType<typeof page.getByTestId>) => {
  await userEvent.keyboard("{Meta>}k{/Meta}");
  const menu = screen.getByRole("menu");
  await expect.element(menu).toBeVisible();
  return menu;
};

const runItem = async (
  screen: ReturnType<typeof page.getByTestId>,
  name: string
) => {
  const menu = await openMenu(screen);
  await menu.getByRole("menuitem", { name }).click();
};

const statusWith = (
  screen: ReturnType<typeof page.getByTestId>,
  text: string
) => screen.getByRole("status").filter({ hasText: text });

const ROWS = answered.answer?.result.rows.length ?? 0;

describe("ask view actions", () => {
  let writeText: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    reduced.value = false;
    writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  });

  afterEach(() => {
    writeText.mockRestore();
  });

  describe("the answer's actions menu", () => {
    it("opens with ⌘K and returns focus to the input on Escape", async () => {
      const { input, screen } = await setup();
      const menu = await openMenu(screen);
      await expect.element(menu).toHaveAccessibleName(`Actions for ${TITLE}`);
      expect(menu.element()).toMatchSnapshot();
      await userEvent.keyboard("{Escape}");
      await expect.poll(() => screen.getByRole("menu").query()).toBeNull();
      await expect.element(input).toHaveFocus();
    });

    it("toggles from the card's actions button", async () => {
      const { screen } = await setup();
      const button = screen.getByRole("button", { name: "Actions" });
      await button.click();
      await expect.element(screen.getByRole("menu")).toBeVisible();
      await expect.element(button).toHaveAttribute("aria-expanded", "true");
      await button.click();
      await expect.poll(() => screen.getByRole("menu").query()).toBeNull();
    });

    it.each([
      ["Copy as CSV", "CSV", "month,region,"],
      ["Copy as TSV", "TSV", "month\tregion\t"],
      ["Copy as Markdown", "Markdown", "| month | region |"],
    ])("%s puts the rows on the clipboard", async (item, label, start) => {
      const { screen } = await setup();
      await runItem(screen, item);
      await expect
        .element(statusWith(screen, `Copied ${ROWS} rows as ${label}`))
        .toBeVisible();
      expect(String(writeText.mock.calls[0]?.[0])).toMatch(
        new RegExp(`^${start.replace("|", "\\|")}`)
      );
    });

    it("copies the SQL from the menu", async () => {
      const { screen } = await setup();
      await runItem(screen, "Copy SQL");
      expect(writeText).toHaveBeenCalledWith(answered.sql);
    });

    it("saves a CSV to Downloads and reveals it", async () => {
      reduced.value = true;
      const { ipc, screen } = await setup();
      await runItem(screen, "Save CSV to Downloads");
      const saved = statusWith(
        screen,
        "Saved monthly-recurring-revenue-by-region.csv"
      );
      await expect.element(saved).toBeVisible();
      expect(saved.element()).toMatchSnapshot();
      expect(ipc.saveToDownloads.mock.calls[0]?.[0]).toMatchObject({
        baseName: "monthly-recurring-revenue-by-region",
        content: expect.stringMatching(/^\uFEFFmonth,region,/),
        extension: "csv",
      });
      await screen.getByRole("button", { name: "Show in Finder" }).click();
      expect(ipc.revealSaved).toHaveBeenCalledWith({ savedId: "saved-1" });
    });

    it("reports a file that couldn't be saved", async () => {
      const { screen } = await setup(answered, {
        saveToDownloads: () => {
          throw new Error("Downloads is full.");
        },
      });
      await runItem(screen, "Save CSV to Downloads");
      const failure = statusWith(screen, "Downloads is full.");
      await expect.element(failure).toBeVisible();
      expect(
        failure.element().querySelector(".text-danger-ink")
      ).not.toBeNull();
    });

    it("opens the name field for Save as Widget", async () => {
      const { screen } = await setup();
      await runItem(screen, "Save as Widget");
      await expect
        .element(screen.getByRole("textbox", { name: "Widget name" }))
        .toHaveFocus();
    });

    it("saves an unsaved answer, then opens the board picker", async () => {
      const { ipc, onAddToBoard, screen } = await setup();
      await runItem(screen, "Add to Board");
      const name = screen.getByRole("textbox", {
        name: "Name the widget to add",
      });
      await expect.element(name).toHaveFocus();
      await userEvent.keyboard("{Enter}");
      await expect.poll(() => onAddToBoard.mock.calls.length).toBe(1);
      expect(onAddToBoard).toHaveBeenCalledWith("w-saved");
      expect(ipc.saveWidget).toHaveBeenCalledOnce();
    });

    it("adds a saved answer to a board straight away", async () => {
      const { ipc, onAddToBoard, screen } = await setup();
      await userEvent.keyboard("{Meta>}s{/Meta}");
      await userEvent.keyboard("{Enter}");
      await expect.element(screen.getByText("Saved · ⌥⏎ to run")).toBeVisible();
      await runItem(screen, "Add to Board");
      expect(onAddToBoard).toHaveBeenCalledWith("w-saved");
      expect(ipc.saveWidget).toHaveBeenCalledOnce();
    });

    it("leaves out the chart on a table view", async () => {
      const { screen } = await setup(
        withShownTurn(answered, { view: "table" })
      );
      const menu = await openMenu(screen);
      await expect
        .element(menu.getByRole("menuitem", { name: "Copy as CSV" }))
        .toBeVisible();
      expect(
        menu.getByRole("menuitem", { name: "Copy Chart as PNG" }).query()
      ).toBeNull();
      expect(menu.element()).toMatchSnapshot();
    });

    it("only offers Copy SQL after an error", async () => {
      const { screen } = await setup(askStateAfter(REFUSED));
      const menu = await openMenu(screen);
      const enabled = menu
        .getByRole("menuitem")
        .elements()
        .filter((item) => item.getAttribute("aria-disabled") !== "true")
        .map((item) => item.textContent);
      expect(enabled).toStrictEqual([expect.stringContaining("Copy SQL")]);
      expect(menu.element()).toMatchSnapshot();
    });
  });

  describe.each([
    ["full motion", false, 1],
    ["reduced motion", true, 0],
  ])("copying the chart with %s", (_label, isReduced, rings) => {
    it("sends a PNG to the clipboard and marks what was copied", async () => {
      reduced.value = isReduced;
      const { ipc, screen } = await setup();
      await runItem(screen, "Copy Chart as PNG");
      await expect.element(statusWith(screen, "Copied chart")).toBeVisible();
      expect(String(ipc.copyImage.mock.calls[0]?.[0]?.pngBase64)).toMatch(
        /^iVBORw0KGgo/
      );
      expect(screen.getByTestId("copied-ring").elements()).toHaveLength(rings);
    });

    it("says so when the chart can't be copied", async () => {
      reduced.value = isReduced;
      const { screen } = await setup(answered, {
        copyImage: () => {
          throw new Error("clipboard refused");
        },
      });
      await runItem(screen, "Copy Chart as PNG");
      await expect
        .element(statusWith(screen, "The chart couldn't be copied."))
        .toBeVisible();
    });
  });
});
