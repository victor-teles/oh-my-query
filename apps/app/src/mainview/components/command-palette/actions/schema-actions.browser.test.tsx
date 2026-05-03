import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { CommandAction } from "@/components/command-palette/types";
import type { SchemaInfo } from "@/lib/tauri";

import {
  CommandPaletteProvider,
  useCommandPalette,
} from "@/components/command-palette/command-palette-provider";

import { SchemaActions } from "./schema-actions";

const captured: { actions: CommandAction[] } = { actions: [] };

const Capture = () => {
  const { actions } = useCommandPalette();
  captured.actions = actions;
  return null;
};

const renderWith = (
  schema: SchemaInfo | null,
  onRefresh = vi.fn(),
  onQueryTable = vi.fn()
) => {
  captured.actions = [];
  return render(
    <CommandPaletteProvider>
      <SchemaActions
        onQueryTable={onQueryTable}
        onRefresh={onRefresh}
        schema={schema}
      />
      <Capture />
    </CommandPaletteProvider>
  );
};

const findAction = (id: string): CommandAction => {
  const action = captured.actions.find((a) => a.id === id);
  if (!action) {
    throw new Error(`Missing action: ${id}`);
  }
  return action;
};

const schemaWith = (
  tables: { name: string }[],
  views: { name: string }[] = []
): SchemaInfo => ({
  schemas: [
    {
      name: "public",
      tables: tables.map((t) => ({
        columns: [],
        foreignKeys: [],
        indexes: [],
        name: t.name,
        rowEstimate: 0,
      })),
      views: views.map((v) => ({ columns: [], name: v.name })),
    },
  ],
});

describe("schema-actions", () => {
  it("registers only Refresh when schema is null", () => {
    renderWith(null);
    expect(captured.actions.map((a) => a.id)).toStrictEqual(["schema.refresh"]);
  });

  it("refresh perform invokes onRefresh", async () => {
    const onRefresh = vi.fn();
    renderWith(null, onRefresh);
    await findAction("schema.refresh").perform();
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("registers a Query action per table and view", () => {
    renderWith(
      schemaWith([{ name: "users" }, { name: "posts" }], [{ name: "v1" }])
    );

    const ids = captured.actions.map((a) => a.id);
    expect(ids).toContain("schema.query-table.public.users");
    expect(ids).toContain("schema.query-table.public.posts");
    expect(ids).toContain("schema.query-view.public.v1");
  });

  it("query <table> perform calls onQueryTable with the name", async () => {
    const onQueryTable = vi.fn();
    renderWith(schemaWith([{ name: "users" }]), vi.fn(), onQueryTable);

    await findAction("schema.query-table.public.users").perform();
    expect(onQueryTable).toHaveBeenCalledExactlyOnceWith("users");
  });
});
