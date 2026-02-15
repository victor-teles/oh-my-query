import type { EditorView } from "@codemirror/view";

import { sql, PostgreSQL, MySQL, SQLite } from "@codemirror/lang-sql";
import { keymap } from "@codemirror/view";
import { githubDark } from "@uiw/codemirror-theme-github";
import CodeMirror from "@uiw/react-codemirror";
import { useCallback, useMemo } from "react";

import type { DatabaseType } from "@/lib/connections";

import { useEditorInsert } from "@/contexts/editor-insert-context";

const DIALECT_MAP = {
  mysql: MySQL,
  postgresql: PostgreSQL,
  sqlite: SQLite,
} as const;

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  databaseType: DatabaseType;
  readOnly?: boolean;
}

export const SqlEditor = ({
  value,
  onChange,
  onExecute,
  databaseType,
  readOnly = false,
}: SqlEditorProps) => {
  const { registerEditor } = useEditorInsert();

  const handleCreateEditor = useCallback(
    (view: EditorView) => {
      registerEditor(view);
    },
    [registerEditor]
  );

  const extensions = useMemo(
    () => [
      sql({ dialect: DIALECT_MAP[databaseType] }),
      keymap.of([
        {
          key: "Mod-Enter",
          run: () => {
            onExecute();
            return true;
          },
        },
      ]),
    ],
    [databaseType, onExecute]
  );

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      onCreateEditor={handleCreateEditor}
      extensions={extensions}
      theme={githubDark}
      placeholder="Write your SQL query here..."
      readOnly={readOnly}
      basicSetup={{
        autocompletion: true,
        bracketMatching: true,
        foldGutter: false,
        highlightActiveLine: true,
        lineNumbers: true,
      }}
      className="h-full overflow-auto text-sm [&_.cm-editor]:h-full [&_.cm-scroller]:h-full [&_.cm-editor]:!bg-background [&_.cm-gutters]:!bg-background [&_.cm-gutters]:!border-r-0 [&_.cm-activeLineGutter]:!bg-background"
    />
  );
};
