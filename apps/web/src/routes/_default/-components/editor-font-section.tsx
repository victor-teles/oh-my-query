import type { Extension } from "@codemirror/state";

import { sql, PostgreSQL } from "@codemirror/lang-sql";
import CodeMirror from "@uiw/react-codemirror";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEditorSettings } from "@/hooks/use-editor-settings";
import { getThemeExtension, PREVIEW_SQL } from "@/lib/codemirror-themes";
import {
  FONT_FAMILIES,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
} from "@/lib/editor-settings";

import { useSettingsFeedback } from "./settings-feedback-context";

const SYSTEM_MONO_STACK =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';

const resolveFontStack = (fontFamily: string): string =>
  fontFamily === "system-default"
    ? SYSTEM_MONO_STACK
    : `"${fontFamily}", ${SYSTEM_MONO_STACK}`;

export const EditorFontSection = () => {
  const { settings, updateSettings } = useEditorSettings();
  const { notifySaved } = useSettingsFeedback();
  const [themeExtension, setThemeExtension] = useState<Extension | null>(null);

  const { fontFamily, fontSize, syntaxTheme } = settings;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const ext = await getThemeExtension(syntaxTheme);
      if (!cancelled) {
        setThemeExtension(ext);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [syntaxTheme]);

  const extensions = useMemo(() => [sql({ dialect: PostgreSQL })], []);

  const previewStyle = useMemo(
    () =>
      ({
        "--cm-font": resolveFontStack(fontFamily),
        "--cm-font-size": `${fontSize}px`,
      }) as React.CSSProperties,
    [fontFamily, fontSize]
  );

  const handleFontFamilyChange = useCallback(
    (v: string | null) => {
      if (v) {
        updateSettings({ fontFamily: v });
        notifySaved();
      }
    },
    [updateSettings, notifySaved]
  );

  const handleFontSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Number.parseInt(e.target.value, 10);
      if (!Number.isNaN(val)) {
        const clamped = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, val));
        updateSettings({ fontSize: clamped });
        notifySaved();
      }
    },
    [updateSettings, notifySaved]
  );

  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">Code Font</h2>
      <p className="mt-1.5 mb-6 text-sm text-muted-foreground">
        Pick a mono face you’re happy to look at all day.
      </p>

      <div className="mb-6 flex flex-wrap items-end gap-5">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium text-foreground">
            Font Family
          </Label>
          <Select onValueChange={handleFontFamilyChange} value={fontFamily}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start" alignItemWithTrigger={false}>
              {FONT_FAMILIES.map((font) => (
                <SelectItem key={font.value} value={font.value}>
                  {font.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium text-foreground">Size</Label>
          <Input
            className="h-7 w-20 text-xs"
            max={FONT_SIZE_MAX}
            min={FONT_SIZE_MIN}
            onChange={handleFontSizeChange}
            step={1}
            type="number"
            value={fontSize}
          />
        </div>
      </div>

      {themeExtension && (
        <div
          className="overflow-hidden rounded-lg ring-1 ring-foreground/10 [&_.cm-content]:[font-family:var(--cm-font)]! [&_.cm-content]:[font-size:var(--cm-font-size)]! [&_.cm-gutters]:[font-family:var(--cm-font)]! [&_.cm-gutters]:[font-size:var(--cm-font-size)]!"
          style={previewStyle}
        >
          <CodeMirror
            basicSetup={{
              autocompletion: false,
              bracketMatching: false,
              closeBrackets: false,
              foldGutter: false,
              highlightActiveLine: false,
              lineNumbers: true,
            }}
            className="max-h-[160px] overflow-hidden text-sm [&_.cm-scroller]:overflow-hidden"
            editable={false}
            extensions={extensions}
            readOnly
            theme={themeExtension}
            value={PREVIEW_SQL}
          />
        </div>
      )}
    </section>
  );
};
