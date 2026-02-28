import type { Extension } from "@codemirror/state";

import { sql, PostgreSQL } from "@codemirror/lang-sql";
import CodeMirror from "@uiw/react-codemirror";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createFontExtension,
  getThemeExtension,
  PREVIEW_SQL,
} from "@/lib/codemirror-themes";
import { cn } from "@/lib/utils";

interface ThemePreviewCardProps {
  themeKey: string;
  label: string;
  isSelected: boolean;
  fontFamily: string;
  fontSize: number;
  onSelect: (key: string) => void;
}

export const ThemePreviewCard = ({
  themeKey,
  label,
  isSelected,
  fontFamily,
  fontSize,
  onSelect,
}: ThemePreviewCardProps) => {
  const [themeExtension, setThemeExtension] = useState<Extension | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const ext = await getThemeExtension(themeKey);
      if (!cancelled) {
        setThemeExtension(ext);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [themeKey]);

  const handleSelect = useCallback(() => {
    onSelect(themeKey);
  }, [onSelect, themeKey]);

  const fontExtension = useMemo(
    () => createFontExtension(fontFamily, fontSize),
    [fontFamily, fontSize]
  );

  const extensions = useMemo(
    () => [sql({ dialect: PostgreSQL }), fontExtension],
    [fontExtension]
  );

  if (!themeExtension) {
    return <div className="h-[120px] animate-pulse rounded-lg bg-muted" />;
  }

  return (
    <button
      type="button"
      onClick={handleSelect}
      className={cn(
        "group cursor-pointer overflow-hidden rounded-lg text-left ring-1 transition-all",
        isSelected
          ? "ring-2 ring-primary"
          : "ring-foreground/10 hover:ring-foreground/25"
      )}
    >
      <div className="pointer-events-none h-[100px] overflow-hidden text-[10px]">
        <CodeMirror
          value={PREVIEW_SQL}
          theme={themeExtension}
          extensions={extensions}
          readOnly
          editable={false}
          basicSetup={{
            autocompletion: false,
            bracketMatching: false,
            closeBrackets: false,
            foldGutter: false,
            highlightActiveLine: false,
            lineNumbers: false,
          }}
          className="h-full [&_.cm-editor]:h-full [&_.cm-scroller]:h-full [&_.cm-scroller]:overflow-hidden"
        />
      </div>
      <div
        className={cn(
          "border-t px-2.5 py-1.5 text-[11px]",
          isSelected
            ? "border-primary/30 text-foreground"
            : "border-foreground/10 text-muted-foreground group-hover:text-foreground"
        )}
      >
        {label}
      </div>
    </button>
  );
};
