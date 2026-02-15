import { sql, PostgreSQL, MySQL, SQLite } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { keymap } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { useMemo } from "react";

import type { DatabaseType } from "@/lib/connections";

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
      extensions={extensions}
      theme={oneDark}
      placeholder="Write your SQL query here..."
      readOnly={readOnly}
      basicSetup={{
        autocompletion: true,
        bracketMatching: true,
        foldGutter: false,
        highlightActiveLine: true,
        lineNumbers: true,
      }}
      className="h-full overflow-auto text-sm [&_.cm-editor]:h-full [&_.cm-scroller]:h-full"
    />
  );
};
