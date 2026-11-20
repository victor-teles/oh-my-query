import type * as NodeOs from "node:os";

import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const TMP_HOME = mkdtempSync(path.join(os.tmpdir(), "conch-core-boards-"));

vi.mock<typeof NodeOs>(import("node:os"), async () => {
  const actual = await vi.importActual<typeof NodeOs>("node:os");
  return {
    ...actual,
    default: { ...actual, homedir: () => TMP_HOME },
    homedir: () => TMP_HOME,
  };
});

const { resetCryptoCache, setLegacyKeyLoader } = await import("./crypto.ts");
const { createBoardStore } = await import("./boards.ts");
const { boardsPath } = await import("./paths.ts");
const { appConfigDir } = await import("./test-utils.ts");

interface TestBoard {
  id: string;
  name: string;
  tiles: { id: string; widgetId: string }[];
}

const parseBoard = (raw: unknown): TestBoard | null => {
  const value = raw as Partial<TestBoard>;
  return Array.isArray(value.tiles) ? (raw as TestBoard) : null;
};

const noLegacyKey = vi
  .fn<() => Promise<string | null>>()
  .mockResolvedValue(null);

const boards = createBoardStore(parseBoard);

const board = (id: string, widgetIds: string[]): TestBoard => ({
  id,
  name: `Board ${id}`,
  tiles: widgetIds.map((widgetId, index) => ({
    id: `${id}-${index}`,
    widgetId,
  })),
});

describe("board store", () => {
  beforeEach(async () => {
    resetCryptoCache();
    setLegacyKeyLoader(noLegacyKey);
    await fs.rm(appConfigDir(TMP_HOME), { force: true, recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TMP_HOME, { force: true, recursive: true });
  });

  it("creates, reads, updates and deletes boards", async () => {
    await boards.saveBoard(board("b1", ["w1"]));
    await boards.saveBoard(board("b2", []));
    await boards.updateBoard("b1", (current) => ({ ...current, name: "Ops" }));

    await expect(boards.getBoard("b1")).resolves.toMatchObject({ name: "Ops" });
    await boards.deleteBoard("b2");
    const remaining = await boards.listBoards();
    expect(remaining.map((item) => item.id)).toStrictEqual(["b1"]);
  });

  it("drops a deleted widget's tiles from every board and reports which", async () => {
    await boards.saveBoard(board("b1", ["w1", "w2"]));
    await boards.saveBoard(board("b2", ["w2", "w2"]));
    await boards.saveBoard(board("b3", ["w3"]));

    const touched = await boards.removeWidgetTiles("w2");

    expect(touched.map((item) => item.id)).toStrictEqual(["b1", "b2"]);
    const all = await boards.listBoards();
    expect(
      all.map((item) => item.tiles.map((tile) => tile.widgetId))
    ).toStrictEqual([["w1"], [], ["w3"]]);
  });

  it("encrypts boards on disk", async () => {
    await boards.saveBoard(board("b1", ["w1"]));
    const raw = await fs.readFile(boardsPath(), "utf8");
    expect(raw).not.toContain("Board b1");
  });
});
