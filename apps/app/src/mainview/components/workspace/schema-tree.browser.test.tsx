import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { SchemaInfo, TableItem, ViewItem } from "@/lib/tauri";

import { EditorInsertProvider } from "@/contexts/editor-insert-context";

import { SchemaTree } from "./schema-tree";

const table = (name: string): TableItem => ({
  columns: [
    {
      dataType: "int",
      defaultValue: null,
      isNullable: false,
      isPrimaryKey: true,
      name: "id",
    },
  ],
  foreignKeys: [],
  indexes: [],
  name,
  rowEstimate: 0,
});

const view = (name: string): ViewItem => ({
  columns: [
    {
      dataType: "text",
      defaultValue: null,
      isNullable: true,
      isPrimaryKey: false,
      name: "label",
    },
  ],
  name,
});

const schemaWith = (
  tables: TableItem[],
  views: ViewItem[] = []
): SchemaInfo => ({
  schemas: [{ name: "public", tables, views }],
});

const renderTree = (
  props: Partial<React.ComponentProps<typeof SchemaTree>> = {}
) =>
  render(
    <EditorInsertProvider>
      <SchemaTree
        favoriteTables={props.favoriteTables ?? []}
        filter={props.filter ?? ""}
        onToggleFavorite={props.onToggleFavorite ?? vi.fn()}
        schema={props.schema ?? schemaWith([table("users"), table("posts")])}
      />
    </EditorInsertProvider>
  );

describe("schema-tree", () => {
  it("renders an empty-state message when there are no tables or views", () => {
    const screen = renderTree({ schema: schemaWith([], []) });
    expect(screen.getByText("No tables or views found")).toBeInTheDocument();
  });

  it("renders all tables when not searching and no favorites", () => {
    const screen = renderTree();
    expect(screen.getByText("users")).toBeInTheDocument();
    expect(screen.getByText("posts")).toBeInTheDocument();
  });

  it("renders a Favorites section ahead of Tables", () => {
    const screen = renderTree({
      favoriteTables: ["users"],
      schema: schemaWith([table("users"), table("posts")]),
    });

    expect(screen.getByText("Favorites (1)")).toBeInTheDocument();
    expect(screen.getByText("Tables (1)")).toBeInTheDocument();
  });

  it("renders a Views section when views exist", () => {
    const screen = renderTree({
      schema: schemaWith([table("users")], [view("user_emails")]),
    });

    expect(screen.getByText("Views (1)")).toBeInTheDocument();
    expect(screen.getByText("user_emails")).toBeInTheDocument();
  });

  it("filters via fuzzy match when searching", () => {
    const screen = renderTree({
      filter: "po",
      schema: schemaWith([table("users"), table("posts")]),
    });

    expect(screen.getByText("posts")).toBeInTheDocument();
    expect(screen.getByText("users").query()).toBeNull();
  });

  it("renders the no-match message when nothing matches the filter", () => {
    const screen = renderTree({
      filter: "zzz",
      schema: schemaWith([table("users")]),
    });

    expect(screen.getByText(/No matches for/)).toBeInTheDocument();
  });

  it("returns null for an empty schemas array", () => {
    const screen = renderTree({ schema: { schemas: [] } });
    expect(screen.container.firstChild).toBeNull();
  });
});
