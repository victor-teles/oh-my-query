import type { Extension } from "@codemirror/state";
import type { ViewUpdate, EditorView } from "@codemirror/view";

import { sql, PostgreSQL, MySQL, SQLite } from "@codemirror/lang-sql";
import { Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { useHotkey } from "@tanstack/react-hotkeys";
import { githubDark } from "@uiw/codemirror-theme-github";
import CodeMirror from "@uiw/react-codemirror";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { SchemaInfo } from "@/lib/tauri";

import { useEditorInsert } from "@/contexts/editor-insert-context";
import { useEditorSettings } from "@/hooks/use-editor-settings";
import {
  createFontExtension,
  getThemeExtension,
} from "@/lib/codemirror-themes";
import {
  createColumnCompletionSource,
  createTableCompletionSource,
  schemaInfoToSQLNamespace,
} from "@/lib/sql-schema";

type SqlDatabaseType = "postgresql" | "mysql" | "sqlite" | "clickhouse";

const DIALECT_MAP: Record<SqlDatabaseType, typeof PostgreSQL> = {
  clickhouse: PostgreSQL,
  mysql: MySQL,
  postgresql: PostgreSQL,
  sqlite: SQLite,
};

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  onUpdate?: (update: ViewUpdate) => void;
  onToggleSyntaxTree?: () => void;
  databaseType: SqlDatabaseType;
  writingDialect?: SqlDatabaseType;
  readOnly?: boolean;
  schema: SchemaInfo | null;
}

export const SqlEditor = ({
  value,
  onChange,
  onExecute,
  onUpdate,
  onToggleSyntaxTree,
  databaseType,
  writingDialect,
  readOnly = false,
  schema,
}: SqlEditorProps) => {
  const { registerEditor } = useEditorInsert();
  const { settings } = useEditorSettings();
  const [themeExtension, setThemeExtension] = useState<Extension>(githubDark);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const ext = await getThemeExtension(settings.syntaxTheme);
      if (!cancelled) {
        setThemeExtension(ext);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [settings.syntaxTheme]);

  const fontExtension = useMemo(
    () => createFontExtension(settings.fontFamily, settings.fontSize),
    [settings.fontFamily, settings.fontSize]
  );

  const handleCreateEditor = useCallback(
    (view: EditorView) => {
      registerEditor(view);
    },
    [registerEditor]
  );

  const sqlNamespace = useMemo(
    () => (schema ? schemaInfoToSQLNamespace(schema) : undefined),
    [schema]
  );

  const columnCompletionSource = useMemo(
    () => (schema ? createColumnCompletionSource(schema) : null),
    [schema]
  );

  const tableCompletionSource = useMemo(
    () => (schema ? createTableCompletionSource(schema) : null),
    [schema]
  );

  const preventNewlineOnExecute = useMemo(
    () =>
      Prec.highest(
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => true,
          },
        ])
      ),
    []
  );

  useHotkey("Mod+Enter", () => {
    onExecute();
  });

  useHotkey(
    "Mod+Shift+D",
    () => {
      onToggleSyntaxTree?.();
    },
    { enabled: import.meta.env.DEV && !!onToggleSyntaxTree }
  );

  const effectiveDialect = writingDialect ?? databaseType;

  const extensions = useMemo(() => {
    const langSupport = sql({
      dialect: DIALECT_MAP[effectiveDialect],
      schema: sqlNamespace,
    });

    const exts: Extension[] = [
      preventNewlineOnExecute,
      langSupport,
      fontExtension,
    ];

    if (tableCompletionSource) {
      exts.push(
        langSupport.language.data.of({
          autocomplete: tableCompletionSource,
        })
      );
    }

    if (columnCompletionSource) {
      exts.push(
        langSupport.language.data.of({
          autocomplete: columnCompletionSource,
        })
      );
    }

    return exts;
  }, [
    preventNewlineOnExecute,
    effectiveDialect,
    sqlNamespace,
    tableCompletionSource,
    columnCompletionSource,
    fontExtension,
  ]);

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      onUpdate={onUpdate}
      onCreateEditor={handleCreateEditor}
      extensions={extensions}
      theme={themeExtension}
      placeholder="Write your SQL query here..."
      readOnly={readOnly}
      basicSetup={{
        autocompletion: true,
        bracketMatching: true,
        foldGutter: false,
        highlightActiveLine: true,
        lineNumbers: true,
      }}
      className="h-full overflow-auto text-sm [&_.cm-editor]:h-full [&_.cm-scroller]:h-full [&_.cm-editor]:bg-background! [&_.cm-gutters]:bg-background! [&_.cm-gutters]:border-r-0! [&_.cm-gutters]:px-2! [&_.cm-activeLineGutter]:bg-background!"
    />
  );
};
