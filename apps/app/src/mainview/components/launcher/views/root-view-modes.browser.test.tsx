import { useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import type { SchemaPeek } from "@/lib/ipc";

import { optionId } from "@/components/launcher/launcher-row";
import { tableItemId } from "@/components/launcher/schema/table-search";
import { SHOW_DELAY_MS } from "@/hooks/use-delayed-visibility";
import { demoSchemaPeek } from "@/lib/browser-schema-stub";
import { makeConnection } from "@/test/connection-fixture";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";

import { resetFirstRunReveal } from "./first-run-note";
import { RootView } from "./root-view";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const analytics = makeConnection({ id: "analytics", name: "analytics" });
const billing = makeConnection({ id: "billing", name: "billing" });
const billingStaging = makeConnection({
  id: "billing-staging",
  name: "billing-staging",
});
const cache = makeConnection({ id: "cache", name: "cache", type: "redis" });

interface HarnessProps {
  initialQuery: string;
  startSql: (sql: string, target: unknown, title?: string) => void;
}

function Harness({ initialQuery, startSql }: HarnessProps) {
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div data-testid="root-harness" style={{ width: 760 }}>
      <RootView
        ask={{ reopen: null, start: vi.fn(), startSql }}
        inputRef={inputRef}
        lookup={{ offer: null, start: vi.fn() }}
        navigate={{
          addToBoard: vi.fn(),
          dismiss: vi.fn(),
          editConnection: vi.fn(),
          newBoard: vi.fn(),
          openBoard: vi.fn(),
          openHistory: vi.fn(),
          openSettings: vi.fn(),
          renameBoard: vi.fn(),
          runWidget: vi.fn(),
        }}
        onQueryChange={setQuery}
        query={query}
      />
    </div>
  );
}

interface SetupOptions {
  query: string;
  active?: string | null;
  connections?: ReturnType<typeof makeConnection>[];
  peekSchema?: () => SchemaPeek | Promise<SchemaPeek>;
}

const setup = async ({
  query,
  active = "analytics",
  connections = [analytics, billing, billingStaging, cache],
  peekSchema = demoSchemaPeek,
}: SetupOptions) => {
  const peek = vi.fn(peekSchema);
  const store = mockLauncherIpc({
    connections,
    handlers: { peekSchema: peek },
  });
  store.active = active ? { connectionId: active, database: null } : null;
  const startSql = vi.fn();
  const screen = renderWithConnections(
    <Harness initialQuery={query} startSql={startSql} />
  );
  const input = screen.getByRole("combobox", { name: "Search commands" });
  await expect.element(input).toBeVisible();
  await input.click();
  return { input, peek, screen, startSql, store };
};

const chip = (screen: Awaited<ReturnType<typeof setup>>["screen"]) =>
  screen.getByRole("img", { name: /Active connection/ });

const resetMotion = () => {
  reduced.value = false;
  resetFirstRunReveal();
};

describe("sQL mode", () => {
  it("offers one read-only SQL row and runs it without the model", async () => {
    const { screen, startSql } = await setup({ query: "> select 1 as one" });
    await expect
      .element(screen.getByText("Run on analytics · read only"))
      .toBeVisible();
    await expect
      .element(screen.getByText("SQL", { exact: true }))
      .toBeVisible();
    await expect.element(screen.getByText("SQL mode")).toBeInTheDocument();
    expect(screen.getByText("Add an AI provider").query()).toBeNull();
    expect(screen.getByRole("listbox").element()).toMatchSnapshot();

    await userEvent.keyboard("{Enter}");
    expect(startSql).toHaveBeenCalledWith("select 1 as one", {
      connectionId: "analytics",
      database: null,
    });
  });

  it("explains what to type before there is any SQL", async () => {
    const { screen } = await setup({ query: ">" });
    const note = screen.getByText(
      "Type a read-only query. ↵ runs it on analytics."
    );
    await expect.element(note).toBeVisible();
    expect(note.element()).toMatchSnapshot();
  });

  it("asks for a connection when none is active", async () => {
    const { screen } = await setup({ active: null, query: "> select 1" });
    await expect
      .element(screen.getByText("Pick a connection to run SQL"))
      .toBeVisible();
  });

  it("declines on a non-SQL engine", async () => {
    const { screen } = await setup({ active: "cache", query: "> get key" });
    await expect
      .element(screen.getByText("SQL runs work with SQL databases."))
      .toBeVisible();
  });
});

describe("table mode", () => {
  beforeEach(resetMotion);

  it("lists tables and shows the selected one's columns", async () => {
    const { screen } = await setup({ query: "#ord" });
    const detail = screen.getByRole("region", { name: "Columns of orders" });
    await expect.element(detail).toHaveTextContent("customer_id");
    await expect.element(detail).toHaveTextContent("→ customers.id");
    await expect
      .element(
        screen.getByText(
          "orders, 5 columns, about 1.2 million rows, primary key id"
        )
      )
      .toBeInTheDocument();
    await expect
      .element(screen.getByRole("option", { name: /orders/ }))
      .toHaveAttribute("aria-describedby", "launcher-table-summary");
    expect(
      screen.getByRole("listbox", { name: "Tables" }).element().closest(".grid")
    ).toMatchSnapshot();
  });

  it("previews the selected table's rows through raw SQL", async () => {
    const { startSql } = await setup({ query: "#ord" });
    await userEvent.keyboard("{Enter}");
    expect(startSql).toHaveBeenCalledWith(
      'SELECT * FROM "public"."orders" LIMIT 50',
      { connectionId: "analytics", database: null },
      "orders"
    );
  });

  it("moves into the column list with ⌘↓ and back with Esc", async () => {
    const { input, screen } = await setup({ query: "#ord" });
    const detail = screen.getByRole("region", { name: "Columns of orders" });
    await expect.element(detail).toBeVisible();
    await userEvent.keyboard("{Meta>}{ArrowDown}{/Meta}");
    await expect.element(detail).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await expect.element(input).toHaveFocus();
  });

  it("shows a skeleton only when the schema is slow", async () => {
    const slow = Promise.withResolvers<SchemaPeek>();
    const { screen } = await setup({
      peekSchema: () => slow.promise,
      query: "",
    });
    const typedAt = performance.now();
    await userEvent.keyboard("#");
    await expect
      .element(screen.getByTestId("table-skeleton"))
      .toBeInTheDocument();
    expect(performance.now() - typedAt).toBeGreaterThanOrEqual(SHOW_DELAY_MS);
    expect(
      screen.getByRole("status", { name: "Loading tables" }).element()
    ).toMatchSnapshot();
    slow.resolve(demoSchemaPeek());
    await expect
      .element(screen.getByRole("region", { name: "Columns of customers" }))
      .toBeVisible();
  });

  it("reports a failed peek and tries again", async () => {
    const peekSchema = vi
      .fn<() => SchemaPeek>()
      .mockImplementationOnce(() => {
        throw new Error("The database refused the connection.");
      })
      .mockImplementation(demoSchemaPeek);
    const { peek, screen } = await setup({ peekSchema, query: "#" });
    const alert = screen.getByRole("alert");
    await expect
      .element(alert)
      .toHaveTextContent("The database refused the connection.");
    expect(alert.element().parentElement).toMatchSnapshot();
    await screen.getByRole("button", { name: "Try again" }).click();
    await expect
      .element(screen.getByRole("region", { name: "Columns of customers" }))
      .toBeVisible();
    expect(peek).toHaveBeenCalledTimes(2);
  });

  it.each([
    [
      "no table matches",
      "#zzz",
      demoSchemaPeek().schema,
      "No table matches “zzz”.",
    ],
    [
      "the schema is empty",
      "#",
      { schemas: [{ name: "public", tables: [], views: [] }] },
      "No tables in public.",
    ],
  ])("says when %s", async (_label, query, schema, text) => {
    const { screen } = await setup({
      peekSchema: () => ({ ...demoSchemaPeek(), schema }),
      query,
    });
    await expect.element(screen.getByText(text)).toBeVisible();
  });
});

describe("connection mode", () => {
  beforeEach(resetMotion);

  it("dims the active chip while choosing", async () => {
    const { screen } = await setup({ query: "@" });
    await expect.element(chip(screen)).toHaveAttribute("data-tone", "pending");
    await expect.element(screen.getByText("Switch connection")).toBeVisible();
    expect(screen.getByRole("listbox").element()).toMatchSnapshot();
  });

  it("commits an exact name on Space and clears the input", async () => {
    const { input, screen } = await setup({ query: "@" });
    await userEvent.keyboard("billing ");
    await expect
      .element(screen.getByRole("img", { name: "Active connection: billing" }))
      .toBeVisible();
    await expect.element(input).toHaveValue("");
  });

  it("commits a unique prefix on Space", async () => {
    const { screen } = await setup({ query: "@" });
    await userEvent.keyboard("cach ");
    await expect
      .element(screen.getByRole("img", { name: "Active connection: cache" }))
      .toBeVisible();
  });

  it("does not commit an ambiguous prefix on Space", async () => {
    const { input, screen } = await setup({ query: "@" });
    await userEvent.keyboard("bil ");
    await expect.element(input).toHaveValue("@bil ");
    await expect
      .element(
        screen.getByRole("img", { name: "Active connection: analytics" })
      )
      .toBeVisible();
  });

  it.each([
    ["Tab", "{Tab}"],
    ["Enter", "{Enter}"],
  ])("commits the selected connection with %s", async (_label, key) => {
    const { input, screen } = await setup({ query: "@billing-st" });
    await expect
      .element(screen.getByRole("option", { name: /billing-staging/ }))
      .toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard(key);
    await expect
      .element(
        screen.getByRole("img", { name: "Active connection: billing-staging" })
      )
      .toBeVisible();
    await expect.element(input).toHaveValue("");
  });
});

describe.each([
  ["full motion", false],
  ["reduced motion", true],
])("mode motion with %s", (_label, isReduced) => {
  it("shows and removes the mode badge", async () => {
    reduced.value = isReduced;
    const { screen } = await setup({ query: "#" });
    await expect
      .element(screen.getByText("Table", { exact: true }))
      .toBeVisible();
    await userEvent.keyboard("{Backspace}");
    await expect
      .poll(() => screen.getByText("Table", { exact: true }).query())
      .toBeNull();
  });

  it("swaps the table detail on ↓", async () => {
    reduced.value = isReduced;
    const { input, screen } = await setup({ query: "#" });
    await expect
      .element(screen.getByRole("region", { name: "Columns of customers" }))
      .toBeVisible();
    await userEvent.keyboard("{ArrowDown}");
    await expect
      .element(input)
      .toHaveAttribute(
        "aria-activedescendant",
        optionId(tableItemId("public", "events"))
      );
    await expect
      .element(screen.getByRole("region", { name: "Columns of events" }))
      .toHaveTextContent("occurred_at");
  });
});
