import { SlidersHorizontalIcon } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { aiSetupCommand, filterCommands, rootCommands } from "./root-commands";

const commands = () =>
  rootCommands({
    addConnection: vi.fn(),
    dismiss: vi.fn(),
    newBoard: vi.fn(),
    openHistory: vi.fn(),
    openSettings: vi.fn(),
  });

describe("rootCommands", () => {
  it("wires each command to its handler", () => {
    const addConnection = vi.fn();
    const openSettings = vi.fn();
    const dismiss = vi.fn();
    const newBoard = vi.fn();
    const openHistory = vi.fn();
    const [add, board, history, settings, hide] = rootCommands({
      addConnection,
      dismiss,
      newBoard,
      openHistory,
      openSettings,
    });

    add?.run();
    board?.run();
    history?.run();
    settings?.run();
    hide?.run();

    expect(addConnection).toHaveBeenCalledOnce();
    expect(newBoard).toHaveBeenCalledOnce();
    expect(openHistory).toHaveBeenCalledOnce();
    expect(openSettings).toHaveBeenCalledOnce();
    expect(dismiss).toHaveBeenCalledOnce();
  });

  it("offers AI setup through Settings", () => {
    const openSettings = vi.fn();
    aiSetupCommand(openSettings).run();
    expect(openSettings).toHaveBeenCalledOnce();
  });
});

describe("filterCommands", () => {
  it("returns every command for an empty or blank query", () => {
    expect(filterCommands(commands(), "")).toHaveLength(5);
    expect(filterCommands(commands(), "   ")).toHaveLength(5);
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
