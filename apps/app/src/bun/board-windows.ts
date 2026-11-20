import { boardFramesPath } from "@conch/core";
import { BrowserWindow, Screen } from "electrobun/main";
import fs from "node:fs/promises";
import path from "node:path";

import type { BoardFrames } from "./board-frames.ts";
import type { FocusState } from "./focus-policy.ts";
import type { AppRpc } from "./rpc.ts";

import { parseBoardFrames, restoredBoardFrame } from "./board-frames.ts";
import { workAreaForPoint } from "./launcher-geometry.ts";

const SAVE_FRAMES_AFTER_MS = 600;

interface OpenBoard {
  window: BrowserWindow;
  rpc: AppRpc;
}

interface BoardWindowsDeps {
  baseUrl: string;
  createRpc(): AppRpc;
  releaseRpc(rpc: AppRpc): void;
}

const boardUrl = (baseUrl: string, boardId: string) =>
  `${baseUrl.split("#")[0]}#/board/${encodeURIComponent(boardId)}`;

const cursorWorkArea = () => {
  const primary = Screen.getPrimaryDisplay().workArea;
  const areas = Screen.getAllDisplays().map((display) => display.workArea);
  return {
    areas,
    current: workAreaForPoint(areas, Screen.getCursorScreenPoint(), primary),
  };
};

const readFrames = async (): Promise<BoardFrames> => {
  try {
    return parseBoardFrames(await fs.readFile(boardFramesPath(), "utf8"));
  } catch {
    return {};
  }
};

export const createBoardWindows = ({
  baseUrl,
  createRpc,
  releaseRpc,
}: BoardWindowsDeps) => {
  const open = new Map<string, OpenBoard>();
  let focusedBoardId: string | null = null;
  let frames: BoardFrames = {};
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  const loadFrames = async () => {
    frames = { ...(await readFrames()), ...frames };
  };
  const loaded = loadFrames();

  const persistFrames = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await fs.mkdir(path.dirname(boardFramesPath()), { recursive: true });
        await fs.writeFile(boardFramesPath(), JSON.stringify(frames));
      } catch (error) {
        console.error(
          `[boards] could not remember window frames: ${String(error)}`
        );
      }
    }, SAVE_FRAMES_AFTER_MS);
  };

  const rememberFrame = (boardId: string, window: BrowserWindow) => {
    frames[boardId] = window.getFrame();
    persistFrames();
  };

  const activate = (boardId: string): boolean => {
    const entry = open.get(boardId);
    if (!entry) {
      return false;
    }
    if (entry.window.isMinimized()) {
      entry.window.unminimize();
    }
    entry.window.show();
    entry.window.activate();
    return true;
  };

  const create = async (boardId: string, title: string) => {
    await loaded;
    const { areas, current } = cursorWorkArea();
    const rpc = createRpc();
    const window = new BrowserWindow({
      frame: restoredBoardFrame(frames[boardId], areas, current),
      rpc,
      title,
      titleBarStyle: "hiddenInset",
      url: boardUrl(baseUrl, boardId),
    });
    open.set(boardId, { rpc, window });
    window.on("focus", () => {
      focusedBoardId = boardId;
    });
    window.on("blur", () => {
      if (focusedBoardId === boardId) {
        focusedBoardId = null;
      }
    });
    window.on("move", () => rememberFrame(boardId, window));
    window.on("resize", () => rememberFrame(boardId, window));
    window.on("close", () => {
      open.delete(boardId);
      releaseRpc(rpc);
      if (focusedBoardId === boardId) {
        focusedBoardId = null;
      }
    });
    window.activate();
  };

  return {
    activate,
    close(boardId: string): void {
      open.get(boardId)?.window.close();
    },
    async open(boardId: string, title: string): Promise<void> {
      if (!activate(boardId)) {
        await create(boardId, title);
      }
    },
    setTitle(boardId: string, title: string): void {
      open.get(boardId)?.window.setTitle(title);
    },
    state(returnBoardId: string | null): FocusState {
      const openBoardIds = [...open.entries()]
        .filter(
          ([, entry]) => entry.window.isVisible() && !entry.window.isMinimized()
        )
        .map(([id]) => id);
      return { focusedBoardId, openBoardIds, returnBoardId };
    },
  };
};

export type BoardWindows = ReturnType<typeof createBoardWindows>;
