import { describe, expect, it, vi } from "vitest";

import {
  aiSetupCommand,
  rootCommands,
} from "@/components/launcher/root-commands";
import { makeConnection } from "@/test/connection-fixture";
import { makeRecent, makeWidget } from "@/test/widget-fixtures";

import { buildRootSections, flattenSections } from "./root-items";

const commands = rootCommands({
  addConnection: vi.fn(),
  dismiss: vi.fn(),
  newBoard: vi.fn(),
  openHistory: vi.fn(),
  openSettings: vi.fn(),
});
const aiSetup = aiSetupCommand(vi.fn());
const connections = [
  makeConnection({ id: "a", name: "billing" }),
  makeConnection({ id: "b", name: "warehouse", pinned: true }),
];

const ids = (sections: ReturnType<typeof buildRootSections>) =>
  flattenSections(sections).map((item) => item.id);

describe("buildRootSections", () => {
  it("lists sorted connections before commands", () => {
    const sections = buildRootSections({
      aiSetup: null,
      commands,
      connections,
      query: "",
    });
    expect(sections.map((section) => section.label)).toStrictEqual([
      "Connections",
      "Commands",
    ]);
    expect(ids(sections)).toStrictEqual([
      "b",
      "a",
      "add-connection",
      "new-board",
      "history",
      "settings",
      "hide",
    ]);
  });

  it("omits the connections section when there are none", () => {
    const sections = buildRootSections({
      aiSetup: null,
      commands,
      connections: [],
      query: "",
    });
    expect(sections.map((section) => section.id)).toStrictEqual(["commands"]);
  });

  it("filters both sections with the query", () => {
    const sections = buildRootSections({
      aiSetup,
      commands,
      connections,
      query: "bill",
    });
    expect(ids(sections)).toStrictEqual(["a"]);
  });

  it("offers AI setup when free text matches nothing", () => {
    const sections = buildRootSections({
      aiSetup,
      commands,
      connections,
      query: "revenue by month",
    });
    expect(sections).toStrictEqual([
      {
        id: "ask",
        items: [{ command: aiSetup, id: "ai-setup", kind: "command" }],
        label: "Ask",
      },
    ]);
  });

  it("returns no sections when nothing matches and AI is ready", () => {
    expect(
      buildRootSections({
        aiSetup: null,
        commands,
        connections,
        query: "zzz",
      })
    ).toStrictEqual([]);
  });

  it("puts an ask row first when a connection can answer the query", () => {
    const sections = buildRootSections({
      aiSetup: null,
      askWith: connections[0],
      commands,
      connections,
      query: "  revenue by region ",
    });
    expect(sections[0]?.label).toBe("Ask");
    expect(flattenSections(sections)[0]).toStrictEqual({
      connection: connections[0],
      id: "ask",
      kind: "ask",
      prompt: "revenue by region",
    });
  });

  it("keeps matches after the ask row", () => {
    const sections = buildRootSections({
      aiSetup: null,
      askWith: connections[0],
      commands,
      connections,
      query: "billing",
    });
    expect(ids(sections)).toStrictEqual(["ask", "a"]);
  });

  it("offers no ask row for an empty query", () => {
    const sections = buildRootSections({
      aiSetup: null,
      askWith: connections[0],
      commands,
      connections,
      query: "  ",
    });
    expect(ids(sections)).not.toContain("ask");
  });

  it("leads with recent asks, then widgets, on an empty query", () => {
    const recents = Array.from({ length: 7 }, (_, index) =>
      makeRecent({ id: `r${index}`, prompt: `question ${index}` })
    );
    const sections = buildRootSections({
      aiSetup: null,
      commands,
      connections,
      query: "",
      recents,
      widgets: [makeWidget()],
    });
    expect(sections.map((section) => section.id)).toStrictEqual([
      "recent",
      "widgets",
      "connections",
      "commands",
    ]);
    expect(sections[0]?.items).toHaveLength(5);
    expect(sections[1]?.items[0]?.id).toBe("widget-w-revenue");
  });

  it("hides recents while typing and puts widget matches after the ask row", () => {
    const sections = buildRootSections({
      aiSetup: null,
      askWith: connections[0],
      commands,
      connections,
      query: "revenue",
      recents: [makeRecent()],
      widgets: [makeWidget()],
    });
    expect(ids(sections)).toStrictEqual(["ask", "widget-w-revenue"]);
  });

  it("counts a widget match so AI setup isn't offered", () => {
    const sections = buildRootSections({
      aiSetup,
      commands,
      connections,
      query: "revenue",
      widgets: [makeWidget()],
    });
    expect(ids(sections)).toStrictEqual(["widget-w-revenue"]);
  });
});

const sectionIds = (sections: ReturnType<typeof buildRootSections>) =>
  sections.map((section) => section.id);

describe("lookup rows", () => {
  const db = makeConnection({ id: "db", name: "db" });
  const UUID = {
    kind: "uuid",
    value: "3f2a1b4c-9d8e-4f7a-b6c5-d4e3f2a1c91e",
  } as const;
  const ID = { kind: "integer", value: "42" } as const;
  const build = (overrides: Partial<Parameters<typeof buildRootSections>[0]>) =>
    buildRootSections({
      aiSetup: null,
      askWith: db,
      commands,
      connections: [],
      lookupWith: db,
      query: "",
      ...overrides,
    });

  it.each([
    ["a UUID before the Ask row", UUID.value, UUID, ["lookup", "ask"]],
    ["an id after the Ask row", "42", ID, ["ask", "lookup"]],
  ])("places %s", (_label, query, lookup, order) => {
    expect(sectionIds(build({ lookup, query }))).toStrictEqual(order);
  });

  it("keeps the lookup next to the AI setup row when nothing else matched", () => {
    const sections = build({
      aiSetup,
      askWith: null,
      lookup: UUID,
      query: UUID.value,
    });
    expect(sectionIds(sections)).toStrictEqual(["lookup", "ask"]);
    expect(ids(sections)).toStrictEqual(["lookup", "ai-setup"]);
  });

  it("needs a SQL connection to look anything up", () => {
    expect(
      sectionIds(build({ lookup: UUID, lookupWith: null, query: UUID.value }))
    ).toStrictEqual(["ask"]);
  });

  it("offers the clipboard above Recent only while the query is empty", () => {
    const recents = [makeRecent({ id: "r1" })];
    expect(sectionIds(build({ offer: UUID, recents }))).toStrictEqual([
      "clipboard",
      "recent",
      "commands",
    ]);
    expect(flattenSections(build({ offer: UUID, recents }))[0]).toMatchObject({
      kind: "lookup",
      origin: "clipboard",
      value: UUID,
    });
    expect(
      sectionIds(build({ offer: UUID, query: "rev", recents }))
    ).not.toContain("clipboard");
  });
});
