import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import type { Board, BoardDraft } from "@/lib/ipc";

import { AppProviders } from "@/components/app-providers";
import { boardWidgets, makeBoard, makeTiles } from "@/test/board-fixtures";
import { emitIpcMessage, mockIpc } from "@/test/ipc-mock";
import { runResult } from "@/test/widget-fixtures";

import { BoardView } from "./board-view";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

type Handler = (payload: Record<string, unknown>) => unknown;

interface SetupOptions {
  board?: Board | null;
  getBoard?: Handler;
  runWidget?: Handler;
}

const setup = ({
  board = makeBoard(),
  getBoard,
  runWidget = () => runResult(),
}: SetupOptions = {}) => {
  let stored = board;
  const calls = {
    openWidgetInLauncher: vi.fn(),
    runWidget: vi.fn(runWidget),
    saveBoard: vi.fn((payload: Record<string, unknown>) => {
      const draft = payload.board as BoardDraft;
      stored = {
        ...(stored ?? makeBoard()),
        ...draft,
        id: draft.id ?? "b-new",
      };
      return stored;
    }),
    toggleLauncher: vi.fn(),
  };
  mockIpc({
    ...calls,
    cancelWidgetRun: vi.fn(),
    getBoard: getBoard ?? (() => stored),
    getLauncherHotkey: () => "Option+Shift+Space",
    listWidgets: () => boardWidgets(),
  });
  render(
    <AppProviders>
      <div data-testid="board" style={{ height: 760, width: 1100 }}>
        <BoardView boardId="b-ops" />
      </div>
    </AppProviders>
  );
  return { calls, screen: page.getByTestId("board") };
};

const lastSaved = (calls: ReturnType<typeof setup>["calls"]) =>
  (calls.saveBoard.mock.lastCall?.[0] as { board: BoardDraft } | undefined)
    ?.board;

const waitForTiles = async (
  screen: ReturnType<typeof setup>["screen"],
  count = 4
) => {
  await expect.poll(() => screen.getByRole("article").all().length).toBe(count);
  await expect.element(screen.getByText("Updated just now")).toBeVisible();
};

const parkPointer = (screen: ReturnType<typeof setup>["screen"]) =>
  userEvent.hover(screen.getByRole("combobox", { name: "Refresh" }));

const settledMain = async (screen: ReturnType<typeof setup>["screen"]) => {
  await parkPointer(screen);
  await expect
    .poll(() => screen.element().querySelector(".recharts-surface"))
    .not.toBeNull();
  return screen.getByRole("main").element();
};

describe.each([
  ["full motion", false, 1],
  ["reduced motion", true, 0],
])("boardView with %s", (_label, isReduced, pulses) => {
  it("renders every tile with its data", async () => {
    reduced.value = isReduced;
    const { calls, screen } = setup();
    await waitForTiles(screen);
    expect(calls.runWidget).toHaveBeenCalledTimes(4);
    await expect
      .element(screen.getByRole("heading", { name: "Ops" }))
      .toBeVisible();
  });

  it("re-runs only the tiles that share a changed input and marks them", async () => {
    reduced.value = isReduced;
    const { calls, screen } = setup();
    await waitForTiles(screen);
    calls.runWidget.mockClear();

    await screen.getByRole("button", { name: /^Period:/ }).click();
    await screen.getByRole("option", { name: "Year to date" }).click();

    await expect.poll(() => calls.runWidget.mock.calls.length).toBe(2);
    expect(
      calls.runWidget.mock.calls.map(([payload]) => payload.widgetId)
    ).toStrictEqual(["w-revenue", "w-signups"]);
    expect(lastSaved(calls)?.sharedValues).toStrictEqual({
      "period:dateRange": "ytd",
    });
    expect(screen.getByTestId("filter-tint").all()).toHaveLength(2);
    await expect
      .poll(() => screen.getByTestId("filter-tint").all().length, {
        timeout: 2000,
      })
      .toBe(0);
  });

  it("reveals drag handles and size controls in edit mode", async () => {
    reduced.value = isReduced;
    const { screen } = setup();
    await waitForTiles(screen);
    await userEvent.keyboard("{Meta>}e{/Meta}");
    await expect
      .element(
        screen.getByRole("button", {
          name: "Drag Revenue by region to reorder",
        })
      )
      .toBeVisible();
    await expect
      .element(screen.getByRole("textbox", { name: "Board name" }))
      .toBeVisible();
  });

  it("scrolls to a newly added tile and pulses it once", async () => {
    reduced.value = isReduced;
    const { calls, screen } = setup();
    await waitForTiles(screen);
    const board = makeBoard();
    calls.saveBoard({
      board: {
        ...board,
        tiles: [...board.tiles, { id: "t5", size: "m", widgetId: "w-orders" }],
      },
    });
    emitIpcMessage("boardChanged", { boardId: "b-ops" });

    await expect
      .element(screen.getByRole("article", { name: "Orders" }))
      .toBeVisible();
    expect(screen.getByTestId("fresh-tile-pulse").all()).toHaveLength(pulses);
  });
});

describe("boardView states", () => {
  it("matches the populated board", async () => {
    reduced.value = true;
    const { screen } = setup({
      board: makeBoard({
        tiles: makeTiles([
          "w-revenue",
          "w-signups",
          "w-churn",
          "w-mrr",
          "w-orders",
        ]),
      }),
    });
    await waitForTiles(screen, 5);
    await expect(settledMain(screen)).resolves.toMatchSnapshot();
  });

  it("matches edit mode", async () => {
    reduced.value = true;
    const { screen } = setup();
    await waitForTiles(screen);
    await userEvent.keyboard("{Meta>}e{/Meta}");
    await expect
      .element(screen.getByRole("textbox", { name: "Board name" }))
      .toBeVisible();
    await expect(settledMain(screen)).resolves.toMatchSnapshot();
  });

  it("explains an empty board", async () => {
    reduced.value = false;
    const { screen } = setup({ board: makeBoard({ tiles: [] }) });
    await expect
      .element(screen.getByText("Add widgets from the launcher"))
      .toBeVisible();
    await parkPointer(screen);
    expect(screen.getByRole("main").element()).toMatchSnapshot();
  });

  it("says when the board is gone", async () => {
    const { screen } = setup({ board: null });
    await expect
      .element(screen.getByText("This board no longer exists."))
      .toBeVisible();
  });

  it("shows a tile error with Retry", async () => {
    const failOnce = vi
      .fn<Handler>()
      .mockRejectedValueOnce(
        Object.assign(new Error('relation "revenue" does not exist'), {
          code: "QUERY_FAILED",
        })
      )
      .mockResolvedValue(runResult());
    const { calls, screen } = setup({
      board: makeBoard({ tiles: makeBoard().tiles.slice(0, 1) }),
      runWidget: failOnce,
    });
    const alert = screen.getByRole("alert");
    await expect.element(alert).toHaveTextContent("The query failed.");
    expect(screen.getByRole("article").element()).toMatchSnapshot();
    await screen.getByRole("button", { name: "Retry" }).click();
    await expect.poll(() => calls.runWidget.mock.calls.length).toBe(2);
    await expect.poll(() => screen.getByRole("alert").query()).toBeNull();
  });

  it("offers Retry when the board cannot load", async () => {
    const getBoard = vi
      .fn<Handler>()
      .mockRejectedValueOnce(new Error("boards.enc is unreadable"))
      .mockResolvedValue(makeBoard());
    const { screen } = setup({ getBoard });
    await expect
      .element(screen.getByText("This board could not load."))
      .toBeVisible();
    await expect
      .element(screen.getByText("boards.enc is unreadable"))
      .toBeVisible();
    await screen.getByRole("button", { name: "Retry" }).click();
    await waitForTiles(screen);
  });

  it("marks a tile whose widget was deleted", async () => {
    const { screen } = setup({
      board: makeBoard({ tiles: [{ id: "t9", size: "m", widgetId: "gone" }] }),
    });
    await expect
      .element(
        screen.getByText(
          "This widget no longer exists. Remove it from the board."
        )
      )
      .toBeVisible();
  });

  it("reloads when another window changes the board", async () => {
    const { calls, screen } = setup();
    await waitForTiles(screen);
    calls.saveBoard({ board: { ...makeBoard(), name: "Ops renamed" } });
    emitIpcMessage("boardChanged", { boardId: "b-ops" });
    await expect
      .element(screen.getByRole("heading", { name: "Ops renamed" }))
      .toBeVisible();
  });
});

describe("boardView header and keys", () => {
  it("refreshes every tile with ⌘R", async () => {
    const { calls, screen } = setup();
    await waitForTiles(screen);
    await userEvent.keyboard("{Meta>}r{/Meta}");
    await expect.poll(() => calls.runWidget.mock.calls.length).toBe(8);
  });

  it("saves a new refresh interval", async () => {
    const { calls, screen } = setup();
    await waitForTiles(screen);
    await screen
      .getByRole("combobox", { name: "Refresh" })
      .selectOptions("Every 5 minutes");
    await expect.poll(() => lastSaved(calls)?.refresh).toBe("5m");
  });

  it("renames the board in edit mode", async () => {
    const { calls, screen } = setup();
    await waitForTiles(screen);
    await screen.getByRole("button", { name: /Edit/ }).click();
    const name = screen.getByRole("textbox", { name: "Board name" });
    await name.fill("Morning metrics");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => lastSaved(calls)?.name).toBe("Morning metrics");
    await userEvent.keyboard("{Escape}");
    await expect
      .element(screen.getByRole("heading", { name: "Morning metrics" }))
      .toBeVisible();
  });

  it("forwards the launcher hotkey to bun with this board", async () => {
    const { calls, screen } = setup();
    await waitForTiles(screen);
    await userEvent.keyboard("{Alt>}{Shift>}{Space}{/Shift}{/Alt}");
    expect(calls.toggleLauncher).toHaveBeenCalledWith({ fromBoardId: "b-ops" });
  });
});

describe("boardView editing", () => {
  it("moves and resizes the focused tile with ⌥ arrows, keeping focus", async () => {
    const { calls, screen } = setup();
    await waitForTiles(screen);
    await userEvent.keyboard("{Meta>}e{/Meta}");
    const tile = screen.getByRole("article", { name: "Signups" });
    tile.element().focus();
    await userEvent.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    await expect
      .poll(() => lastSaved(calls)?.tiles.map((item) => item.widgetId))
      .toStrictEqual(["w-signups", "w-revenue", "w-churn", "w-mrr"]);
    await expect.element(tile).toHaveFocus();

    await userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}");
    await expect.poll(() => lastSaved(calls)?.tiles[0]?.size).toBe("l");
  });

  it("reorders by dragging the handle", async () => {
    const { calls, screen } = setup();
    await waitForTiles(screen);
    await userEvent.keyboard("{Meta>}e{/Meta}");
    await userEvent.dragAndDrop(
      screen.getByRole("button", { name: "Drag Revenue by region to reorder" }),
      screen.getByRole("article", { name: "MRR" })
    );
    await expect
      .poll(() => lastSaved(calls)?.tiles[0]?.widgetId)
      .not.toBe("w-revenue");
  });

  it("removes, resizes and opens a tile from its menu", async () => {
    const { calls, screen } = setup();
    await waitForTiles(screen);
    const openMenu = async (name: string) => {
      await screen.getByRole("button", { name: `Actions for ${name}` }).click();
      return screen.getByRole("menu", { name: `Actions for ${name}` });
    };

    let menu = await openMenu("Churn");
    await menu.getByRole("menuitem", { name: "Full width" }).click();
    await expect.poll(() => lastSaved(calls)?.tiles[2]?.size).toBe("wide");

    menu = await openMenu("Signups");
    await menu.getByRole("menuitem", { name: "Open in Launcher" }).click();
    expect(calls.openWidgetInLauncher).toHaveBeenCalledWith({
      widgetId: "w-signups",
    });

    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();
    menu = await openMenu("Revenue by region");
    await menu.getByRole("menuitem", { name: "Copy SQL" }).click();
    expect(writeText).toHaveBeenCalledWith("select … where region = $1");

    menu = await openMenu("MRR");
    await menu.getByRole("menuitem", { name: "Remove from Board" }).click();
    await expect.poll(() => screen.getByRole("article").all().length).toBe(3);
    expect(lastSaved(calls)?.tiles.map((tile) => tile.widgetId)).not.toContain(
      "w-mrr"
    );
  });
});
