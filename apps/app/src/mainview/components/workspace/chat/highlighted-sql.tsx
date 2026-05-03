import type { Extension } from "@codemirror/state";

import { PostgreSQL, sql } from "@codemirror/lang-sql";
import { EditorView } from "@codemirror/view";
import { githubDark } from "@uiw/codemirror-theme-github";
import CodeMirror from "@uiw/react-codemirror";
import { useEffect, useMemo, useState } from "react";

import { useTheme } from "@/components/theme-provider";
import { useEditorSettings } from "@/hooks/use-editor-settings";
import {
  createFontExtension,
  getThemeExtension,
  resolveSyntaxTheme,
} from "@/lib/codemirror-themes";
import { cn } from "@/lib/utils";

interface HighlightedSqlProps {
  code: string;
  className?: string;
}

const chatEditorChrome = EditorView.theme({
  "&": { backgroundColor: "transparent" },
  "&.cm-focused": { outline: "none" },
  ".cm-content": { padding: "0.75rem" },
  ".cm-gutters": { display: "none" },
  ".cm-line": { padding: "0" },
  ".cm-scroller": { lineHeight: "1.5" },
});

export const HighlightedSql = ({ code, className }: HighlightedSqlProps) => {
  const { settings } = useEditorSettings();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";
  const effectiveThemeKey = resolveSyntaxTheme(settings.syntaxTheme, isDark);
  const [themeExtension, setThemeExtension] = useState<Extension>(githubDark);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const ext = await getThemeExtension(effectiveThemeKey);
      if (!cancelled) {
        setThemeExtension(ext);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [effectiveThemeKey]);

  const fontExtension = useMemo(
    () => createFontExtension(settings.fontFamily, settings.fontSize),
    [settings.fontFamily, settings.fontSize]
  );

  const extensions = useMemo(
    () => [
      sql({ dialect: PostgreSQL }),
      chatEditorChrome,
      fontExtension,
      EditorView.lineWrapping,
    ],
    [fontExtension]
  );

  return <CodeMirror basicSetup={false} className={cn(`
          overflow-x-auto
          [&_.cm-editor]:bg-transparent!
          [&_.cm-editor.cm-focused]:outline-none!
        `, className)} editable={false} extensions={extensions} theme={themeExtension} value={code} />;
};
