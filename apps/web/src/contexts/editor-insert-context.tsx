import type { ReactNode } from "react";

import { EditorView } from "@codemirror/view";
import { createContext, use, useCallback, useRef } from "react";

import type { ErrorLocation } from "@/lib/error-location";

interface EditorInsertContextValue {
  focusEditor: () => boolean;
  getSelectedText: () => string | null;
  hasSelection: () => boolean;
  insertAtCursor: (text: string) => void;
  jumpTo: (location: ErrorLocation) => void;
  openQuery: (sql: string) => void;
  openQueryAndRun: (sql: string) => void;
  queryTable: (tableName: string) => void;
  registerEditor: (view: EditorView | null) => void;
  registerOpenQuery: (handler: ((sql: string) => void) | null) => void;
  registerOpenQueryAndRun: (handler: ((sql: string) => void) | null) => void;
  registerQueryTable: (handler: ((tableName: string) => void) | null) => void;
  replaceSelection: (text: string) => void;
}

const EditorInsertContext = createContext<EditorInsertContextValue | null>(
  null
);

export const EditorInsertProvider = ({ children }: { children: ReactNode }) => {
  const editorRef = useRef<EditorView | null>(null);
  const queryTableRef = useRef<((tableName: string) => void) | null>(null);
  const openQueryRef = useRef<((sql: string) => void) | null>(null);
  const openQueryAndRunRef = useRef<((sql: string) => void) | null>(null);

  const registerEditor = useCallback((view: EditorView | null) => {
    editorRef.current = view;
  }, []);

  const registerQueryTable = useCallback(
    (handler: ((tableName: string) => void) | null) => {
      queryTableRef.current = handler;
    },
    []
  );

  const registerOpenQuery = useCallback(
    (handler: ((sql: string) => void) | null) => {
      openQueryRef.current = handler;
    },
    []
  );

  const registerOpenQueryAndRun = useCallback(
    (handler: ((sql: string) => void) | null) => {
      openQueryAndRunRef.current = handler;
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

  const hasSelection = useCallback((): boolean => {
    const view = editorRef.current;
    if (!view) {
      return false;
    }
    const { from, to } = view.state.selection.main;
    return from !== to;
  }, []);

  const replaceSelection = useCallback((text: string) => {
    const view = editorRef.current;
    if (!view) {
      return;
    }

    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, insert: text, to },
      selection: { anchor: from + text.length },
    });
    view.focus();
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

  const jumpTo = useCallback((location: ErrorLocation) => {
    const view = editorRef.current;
    if (!view) {
      return;
    }

    const { doc } = view.state;
    let pos: number;

    if (location.position !== undefined) {
      pos = Math.max(0, Math.min(location.position, doc.length));
    } else if (location.line !== undefined) {
      const lineNumber = Math.max(1, Math.min(location.line, doc.lines));
      const line = doc.line(lineNumber);
      const col = Math.max(1, location.column ?? 1);
      pos = Math.min(line.from + col - 1, line.to);
    } else {
      return;
    }

    view.dispatch({
      effects: EditorView.scrollIntoView(pos, { y: "center" }),
      selection: { anchor: pos },
    });
    view.focus();
  }, []);

  const focusEditor = useCallback((): boolean => {
    const view = editorRef.current;
    if (!view) {
      return false;
    }
    view.focus();
    return true;
  }, []);

  const queryTable = useCallback((tableName: string) => {
    queryTableRef.current?.(tableName);
  }, []);

  const openQuery = useCallback((sql: string) => {
    openQueryRef.current?.(sql);
  }, []);

  const openQueryAndRun = useCallback((sql: string) => {
    const handler = openQueryAndRunRef.current ?? openQueryRef.current;
    handler?.(sql);
  }, []);

  return (
    <EditorInsertContext
      value={{
        focusEditor,
        getSelectedText,
        hasSelection,
        insertAtCursor,
        jumpTo,
        openQuery,
        openQueryAndRun,
        queryTable,
        registerEditor,
        registerOpenQuery,
        registerOpenQueryAndRun,
        registerQueryTable,
        replaceSelection,
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
