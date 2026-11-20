import { SlidersHorizontalIcon } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { aiSetupCommand, filterCommands, rootCommands } from "./root-commands";

const handlers = () => ({
  addConnection: vi.fn(),
  dismiss: vi.fn(),
  exportAll: vi.fn(),
  newBoard: vi.fn(),
  openHistory: vi.fn(),
  openImport: vi.fn(),
  openSettings: vi.fn(),
});

const commands = () => rootCommands(handlers());

describe("rootCommands", () => {
  it("wires each command to its handler", () => {
    const wired = handlers();
    for (const command of rootCommands(wired)) {
      command.run();
    }
    for (const handler of Object.values(wired)) {
      expect(handler).toHaveBeenCalledOnce();
    }
  });

  it("offers export and import of widgets and boards", () => {
    const wired = handlers();
    const byId = new Map(rootCommands(wired).map((c) => [c.id, c]));
    expect(byId.get("export-bundle")).toMatchObject({
      actionLabel: "Export",
      subtitle: "Saves a .omq.json to Downloads",
      title: "Export Widgets and Boards",
    });
    byId.get("import-bundle")?.run();
    expect(wired.openImport).toHaveBeenCalledOnce();
  });

  it("finds export and import by their keywords", () => {
    expect(filterCommands(commands(), "backup").map((c) => c.id)).toStrictEqual(
      ["export-bundle"]
    );
    expect(
      filterCommands(commands(), "restore").map((c) => c.id)
    ).toStrictEqual(["import-bundle"]);
  });

  it("offers AI setup through Settings", () => {
    const openSettings = vi.fn();
    aiSetupCommand(openSettings).run();
    expect(openSettings).toHaveBeenCalledOnce();
  });
});

describe("filterCommands", () => {
  it("returns every command for an empty or blank query", () => {
    expect(filterCommands(commands(), "")).toHaveLength(7);
    expect(filterCommands(commands(), "   ")).toHaveLength(7);
  });

  it("matches titles fuzzily", () => {
    expect(filterCommands(commands(), "sttng").map((c) => c.id)).toStrictEqual([
      "settings",
    ]);
  });

  it("matches keywords", () => {
    expect(filterCommands(commands(), "theme").map((c) => c.id)).toStrictEqual([
      "settings",
    ]);
    expect(filterCommands(commands(), "close").map((c) => c.id)).toStrictEqual([
      "hide",
    ]);
  });

  it("finds Search History by its keywords", () => {
    expect(filterCommands(commands(), "past").map((c) => c.id)).toStrictEqual([
      "history",
    ]);
    expect(filterCommands(commands(), "recent").map((c) => c.id)).toStrictEqual(
      ["history"]
    );
  });

  it("returns nothing when no command matches", () => {
    expect(filterCommands(commands(), "zzz")).toStrictEqual([]);
  });

  it("ranks the stronger match first", () => {
    const command = (id: string, title: string) => ({
      actionLabel: "Open",
      icon: SlidersHorizontalIcon,
      id,
      run: vi.fn(),
      subtitle: "",
      title,
    });
    const ranked = filterCommands(
      [command("loose", "Update data sources"), command("exact", "Data")],
      "data"
    );
    expect(ranked.map((c) => c.id)).toStrictEqual(["exact", "loose"]);
  });
});
