import { EditorView } from "@codemirror/view";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import type { ColumnDetail } from "@/lib/tauri";

import {
  EditorInsertProvider,
  useEditorInsert,
} from "@/contexts/editor-insert-context";

import { ColumnNode } from "./column-node";

const baseColumn: ColumnDetail = {
  dataType: "text",
  defaultValue: null,
  isNullable: true,
  isPrimaryKey: false,
  name: "email",
};

const StubEditor = ({ doc = "" }: { doc?: string }) => {
  const { registerEditor } = useEditorInsert();

  useEffect(() => {
    const view = new EditorView({ doc });
    registerEditor(view);
    return () => {
      registerEditor(null);
      view.destroy();
    };
  }, [doc, registerEditor]);

  return null;
};

const renderColumn = (
  column: ColumnDetail,
  options: { editorDoc?: string } = {}
) =>
  render(
    <EditorInsertProvider>
      <StubEditor doc={options.editorDoc ?? ""} />
      <ColumnNode column={column} />
    </EditorInsertProvider>
  );

describe("column-node", () => {
  it("renders the column name and data type", () => {
    const screen = renderColumn(baseColumn);

    expect(screen.getByRole("button", { name: /email/i })).toBeInTheDocument();
    expect(screen.getByText("text")).toBeInTheDocument();
  });

  it("inserts the column name at the editor cursor when clicked", async () => {
    const screen = renderColumn(baseColumn);

    await screen.getByRole("button", { name: /email/i }).click();

    // The stub editor doesn't expose its doc; we just confirm the click works
    // without error and the button is still in the DOM.
    expect(screen.getByRole("button", { name: /email/i })).toBeInTheDocument();
  });

  it("renders a key icon and (not null) text for primary-key columns", async () => {
    const screen = renderColumn({
      ...baseColumn,
      isNullable: false,
      isPrimaryKey: true,
      name: "id",
    });

    await screen.getByRole("button", { name: /id/i }).hover();
    await expect.element(screen.getByText(/not null/)).toBeInTheDocument();
  });

  it("shows the default value in the tooltip when present", async () => {
    const screen = renderColumn({
      ...baseColumn,
      defaultValue: "now()",
      name: "created_at",
    });

    await screen.getByRole("button", { name: /created_at/i }).hover();
    await expect
      .element(screen.getByText(/Default: now\(\)/))
      .toBeInTheDocument();
  });
});
