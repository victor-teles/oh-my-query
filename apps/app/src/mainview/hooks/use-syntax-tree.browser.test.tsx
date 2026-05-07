import { sql } from "@codemirror/lang-sql";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { act } from "react";
import { describe, expect, it } from "vitest";

import { useSyntaxTree } from "@/hooks/use-syntax-tree";
import { renderHook, waitFor } from "@/test/render-hook";

const buildView = (doc: string): EditorView => {
  const state = EditorState.create({ doc, extensions: [sql()] });
  return new EditorView({ state });
};

const dispatch = (
  view: EditorView,
  override: Partial<{ docChanged: boolean; selectionSet: boolean }> = {}
) => {
  // Construct a synthetic ViewUpdate-like object
  const update = {
    docChanged: override.docChanged ?? false,
    selectionSet: override.selectionSet ?? false,
    state: view.state,
  } as unknown as Parameters<
    ReturnType<typeof useSyntaxTree>["handleEditorUpdate"]
  >[0];
  return update;
};

describe("useSyntaxTree", () => {
  it("returns an empty tree when disabled", () => {
    const { result } = renderHook(() => useSyntaxTree(false));
    expect(result.current.treeData.root).toBeNull();
  });

  it("ignores updates while disabled", () => {
    const { result } = renderHook(() => useSyntaxTree(false));
    const view = buildView("SELECT 1");
    act(() => {
      result.current.handleEditorUpdate(dispatch(view, { selectionSet: true }));
    });
    expect(result.current.treeData.root).toBeNull();
  });

  it("processes selectionSet updates synchronously", () => {
    const { result } = renderHook(() => useSyntaxTree(true));
    const view = buildView("SELECT 1");
    act(() => {
      result.current.handleEditorUpdate(dispatch(view, { selectionSet: true }));
    });
    expect(result.current.treeData.root).not.toBeNull();
    expect(result.current.treeData.root?.children.length).toBeGreaterThan(0);
  });

  it("debounces docChanged updates", async () => {
    const { result } = renderHook(() => useSyntaxTree(true));
    const view = buildView("SELECT 1");
    act(() => {
      result.current.handleEditorUpdate(dispatch(view, { docChanged: true }));
    });
    // Not yet processed
    expect(result.current.treeData.root).toBeNull();
    await waitFor(() => expect(result.current.treeData.root).not.toBeNull(), {
      timeout: 500,
    });
  });
});
