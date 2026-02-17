import type { EditorView } from "@codemirror/view";
import type { ReactNode } from "react";

import { createContext, use, useCallback, useRef } from "react";

interface EditorInsertContextValue {
  getSelectedText: () => string | null;
  insertAtCursor: (text: string) => void;
  queryTable: (tableName: string) => void;
  registerEditor: (view: EditorView | null) => void;
  registerQueryTable: (handler: ((tableName: string) => void) | null) => void;
}

const EditorInsertContext = createContext<EditorInsertContextValue | null>(
  null
);

export const EditorInsertProvider = ({ children }: { children: ReactNode }) => {
  const editorRef = useRef<EditorView | null>(null);
  const queryTableRef = useRef<((tableName: string) => void) | null>(null);

  const registerEditor = useCallback((view: EditorView | null) => {
    editorRef.current = view;
  }, []);

  const registerQueryTable = useCallback(
    (handler: ((tableName: string) => void) | null) => {
      queryTableRef.current = handler;
    },
    []
  );

  const getSelectedText = useCallback((): string | null => {
    const view = editorRef.current;
    if (!view) {
      return null;
    }
    const { from, to } = view.state.selection.main;
    if (from === to) {
      return null;
    }
    return view.state.sliceDoc(from, to);
  }, []);

  const insertAtCursor = useCallback((text: string) => {
    const view = editorRef.current;
    if (!view) {
      return;
    }

    const { from } = view.state.selection.main;
    view.dispatch({
      changes: { from, insert: text },
      selection: { anchor: from + text.length },
    });
    view.focus();
  }, []);

  const queryTable = useCallback((tableName: string) => {
    queryTableRef.current?.(tableName);
  }, []);

  return (
    <EditorInsertContext
      value={{
        getSelectedText,
        insertAtCursor,
        queryTable,
        registerEditor,
        registerQueryTable,
      }}
    >
      {children}
    </EditorInsertContext>
  );
};

export const useEditorInsert = (): EditorInsertContextValue => {
  const ctx = use(EditorInsertContext);
  if (!ctx) {
    throw new Error(
      "useEditorInsert must be used within an EditorInsertProvider"
    );
  }
  return ctx;
};
