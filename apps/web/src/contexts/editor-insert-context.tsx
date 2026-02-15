import type { EditorView } from "@codemirror/view";
import type { ReactNode } from "react";

import { createContext, use, useCallback, useRef } from "react";

interface EditorInsertContextValue {
  insertAtCursor: (text: string) => void;
  registerEditor: (view: EditorView | null) => void;
}

const EditorInsertContext = createContext<EditorInsertContextValue | null>(
  null
);

export const EditorInsertProvider = ({ children }: { children: ReactNode }) => {
  const editorRef = useRef<EditorView | null>(null);

  const registerEditor = useCallback((view: EditorView | null) => {
    editorRef.current = view;
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

  return (
    <EditorInsertContext value={{ insertAtCursor, registerEditor }}>
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
