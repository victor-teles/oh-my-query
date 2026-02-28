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
import {
  createFontExtension,
  getThemeExtension,
  PREVIEW_SQL,
} from "@/lib/codemirror-themes";
import {
  FONT_FAMILIES,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
} from "@/lib/editor-settings";

interface EditorFontSectionProps {
  fontFamily: string;
  fontSize: number;
  syntaxTheme: string;
  onFontFamilyChange: (family: string) => void;
  onFontSizeChange: (size: number) => void;
}

export const EditorFontSection = ({
  fontFamily,
  fontSize,
  syntaxTheme,
  onFontFamilyChange,
  onFontSizeChange,
}: EditorFontSectionProps) => {
  const [themeExtension, setThemeExtension] = useState<Extension | null>(null);

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

  const fontExtension = useMemo(
    () => createFontExtension(fontFamily, fontSize),
    [fontFamily, fontSize]
  );

  const extensions = useMemo(
    () => [sql({ dialect: PostgreSQL }), fontExtension],
    [fontExtension]
  );

  const handleFontFamilyChange = useCallback(
    (v: string | null) => {
      if (v) {
        onFontFamilyChange(v);
      }
    },
    [onFontFamilyChange]
  );

  const handleFontSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Number.parseInt(e.target.value, 10);
      if (!Number.isNaN(val)) {
        const clamped = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, val));
        onFontSizeChange(clamped);
      }
    },
    [onFontSizeChange]
  );

  return (
    <section>
      <h2 className="mb-1 text-sm font-medium">Code Font</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Customize the font used in the SQL editor.
      </p>

      <div className="mb-4 flex items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Font Family</Label>
          <Select value={fontFamily} onValueChange={handleFontFamilyChange}>
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
          <Label className="text-xs text-muted-foreground">Size</Label>
          <Input
            type="number"
            value={fontSize}
            onChange={handleFontSizeChange}
            min={FONT_SIZE_MIN}
            max={FONT_SIZE_MAX}
            step={1}
            className="h-7 w-18 text-xs"
          />
        </div>
      </div>

      {themeExtension && (
        <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
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
              lineNumbers: true,
            }}
            className="max-h-[160px] overflow-hidden text-sm [&_.cm-scroller]:overflow-hidden"
          />
        </div>
      )}
    </section>
  );
};
