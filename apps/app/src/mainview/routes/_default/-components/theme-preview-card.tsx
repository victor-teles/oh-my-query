import type { Extension } from "@codemirror/state";

import { sql, PostgreSQL } from "@codemirror/lang-sql";
import CodeMirror from "@uiw/react-codemirror";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getThemeExtension, PREVIEW_SQL } from "@/lib/codemirror-themes";
import { cn } from "@/lib/utils";

const SYSTEM_MONO_STACK =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';

const resolveFontStack = (fontFamily: string): string =>
  fontFamily === "system-default"
    ? SYSTEM_MONO_STACK
    : `"${fontFamily}", ${SYSTEM_MONO_STACK}`;

const STATIC_EXTENSIONS = [sql({ dialect: PostgreSQL })];

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
  const [pulseKey, setPulseKey] = useState<number | null>(null);
  const reduced = useReducedMotion();

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
    setPulseKey(Date.now());
  }, [onSelect, themeKey]);

  const handlePulseComplete = useCallback(() => {
    setPulseKey(null);
  }, []);

  const previewStyle = useMemo(
    () =>
      ({
        "--cm-font": resolveFontStack(fontFamily),
        "--cm-font-size": `${fontSize}px`,
      }) as React.CSSProperties,
    [fontFamily, fontSize]
  );

  if (!themeExtension) {
    return (
      <div className="overflow-hidden rounded-lg ring-2 ring-foreground/10">
        <div className="h-[100px] animate-pulse bg-muted" />
        <div className="border-t border-foreground/10 px-3 py-2">
          <div className="h-3.5 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        className={cn(
          "group block w-full cursor-pointer overflow-hidden rounded-lg text-left ring-2 transition-colors",
          "focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring",
          isSelected
            ? "ring-primary"
            : "ring-foreground/10 hover:ring-foreground/25"
        )}
        onClick={handleSelect}
        type="button"
      >
        <div
          className="pointer-events-none h-[100px] overflow-hidden text-[10px] [&_.cm-content]:[font-family:var(--cm-font)]! [&_.cm-content]:[font-size:var(--cm-font-size)]! [&_.cm-gutters]:[font-family:var(--cm-font)]! [&_.cm-gutters]:[font-size:var(--cm-font-size)]!"
          style={previewStyle}
        >
          <CodeMirror
            basicSetup={{
              autocompletion: false,
              bracketMatching: false,
              closeBrackets: false,
              foldGutter: false,
              highlightActiveLine: false,
              lineNumbers: false,
            }}
            className="h-full [&_.cm-editor]:h-full [&_.cm-scroller]:h-full [&_.cm-scroller]:overflow-hidden"
            editable={false}
            extensions={STATIC_EXTENSIONS}
            readOnly
            theme={themeExtension}
            value={PREVIEW_SQL}
          />
        </div>
        <div
          className={cn(
            "border-t px-3 py-2 text-sm font-medium transition-colors",
            isSelected
              ? "border-primary/30 text-foreground"
              : "border-foreground/10 text-muted-foreground group-hover:text-foreground"
          )}
        >
          {label}
        </div>
      </button>
      {pulseKey !== null && (
        <motion.div
          animate={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.05 }}
          className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-primary"
          initial={reduced ? { opacity: 0.6 } : { opacity: 0.9, scale: 1 }}
          key={pulseKey}
          onAnimationComplete={handlePulseComplete}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        />
      )}
    </div>
  );
};
