import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { TableItem, ViewItem } from "@/lib/tauri";

import {
  EditorInsertProvider,
  useEditorInsert,
} from "@/contexts/editor-insert-context";

import { TableNode } from "./table-node";

const baseTable: TableItem = {
  columns: [
    {
      dataType: "int",
      defaultValue: null,
      isNullable: false,
      isPrimaryKey: true,
      name: "id",
    },
    {
      dataType: "text",
      defaultValue: null,
      isNullable: true,
      isPrimaryKey: false,
      name: "email",
    },
  ],
  foreignKeys: [],
  indexes: [],
  name: "users",
  rowEstimate: 1234,
};

const QueryTableProbe = ({ capture }: { capture: { last: string | null } }) => {
  const { registerQueryTable } = useEditorInsert();

  useEffect(() => {
    registerQueryTable((name) => {
      capture.last = name;
    });
    return () => registerQueryTable(null);
  }, [capture, registerQueryTable]);

  return null;
};

const renderNode = (
  props: Partial<React.ComponentProps<typeof TableNode>> = {},
  capture?: { last: string | null }
) =>
  render(
    <EditorInsertProvider>
      {capture ? <QueryTableProbe capture={capture} /> : null}
      <TableNode
        highlightMatches={props.highlightMatches}
        isFavorite={props.isFavorite}
        isView={props.isView}
        onToggleFavorite={props.onToggleFavorite}
        table={props.table ?? baseTable}
      />
    </EditorInsertProvider>
  );

describe("table-node", () => {
  it("renders the table name in the trigger", () => {
    const screen = renderNode();
    expect(screen.getByText("users")).toBeInTheDocument();
  });

  it("expands columns when the trigger is clicked", async () => {
    const screen = renderNode();

    await screen.getByRole("button", { name: /users/i }).first().click();

    await expect.element(screen.getByText("Columns (2)")).toBeInTheDocument();
    await expect
      .element(screen.getByText("id", { exact: true }))
      .toBeInTheDocument();
    await expect.element(screen.getByText("email")).toBeInTheDocument();
  });

  it("invokes queryTable from the inline Play button", async () => {
    const capture = { last: null as string | null };
    const screen = renderNode({}, capture);

    await screen.getByRole("button", { name: /query users/i }).click();

    expect(capture.last).toBe("users");
  });

  it("highlights matched name segments via <mark>", () => {
    const screen = renderNode({ highlightMatches: [0, 1] });
    const marks = screen.container.querySelectorAll("mark");
    expect(marks.length).toBeGreaterThan(0);
    expect(marks[0]?.textContent).toBe("us");
  });

  it("renders a star indicator for favorited tables", () => {
    const onToggleFavorite = vi.fn();
    const screen = renderNode({ isFavorite: true, onToggleFavorite });

    const stars = screen.container.querySelectorAll(".lucide-star");
    expect(stars.length).toBeGreaterThan(0);
  });

  it("uses a different icon and skips index/FK sections for views", async () => {
    const view: ViewItem = {
      columns: baseTable.columns,
      name: "user_view",
    };
    const screen = renderNode({ isView: true, table: view });

    await screen
      .getByRole("button", { name: /user_view/i })
      .first()
      .click();

    await expect.element(screen.getByText("Columns (2)")).toBeInTheDocument();
    expect(screen.getByText(/Indexes/).query()).toBeNull();
    expect(screen.getByText(/Foreign Keys/).query()).toBeNull();
  });

  it("renders indexes and foreign keys sections when present", async () => {
    const screen = renderNode({
      table: {
        ...baseTable,
        foreignKeys: [
          {
            columns: ["author_id"],
            name: "fk_author",
            referencedColumns: ["id"],
            referencedTable: "authors",
          },
        ],
        indexes: [
          { columns: ["email"], isUnique: true, name: "users_email_idx" },
        ],
      },
    });

    await screen.getByRole("button", { name: /users/i }).first().click();

    await expect.element(screen.getByText("Indexes (1)")).toBeInTheDocument();
    await expect
      .element(screen.getByText("users_email_idx"))
      .toBeInTheDocument();
    await expect.element(screen.getByText("unique")).toBeInTheDocument();
    await expect
      .element(screen.getByText("Foreign Keys (1)"))
      .toBeInTheDocument();
    await expect.element(screen.getByText(/author_id/)).toBeInTheDocument();
  });
});
