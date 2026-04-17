import { useCallback, useMemo } from "react";

import { useTheme } from "@/components/theme-provider";
import { useEditorSettings } from "@/hooks/use-editor-settings";
import { resolveSyntaxTheme, THEME_ENTRIES } from "@/lib/codemirror-themes";

import { useSettingsFeedback } from "./settings-feedback-context";
import { ThemePreviewCard } from "./theme-preview-card";

export const SyntaxThemeSection = () => {
  const { settings, updateSettings } = useEditorSettings();
  const { notifySaved } = useSettingsFeedback();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  const visibleThemes = useMemo(
    () => THEME_ENTRIES.filter((entry) => entry.isDark === isDark),
    [isDark]
  );

  const effectiveTheme = resolveSyntaxTheme(settings.syntaxTheme, isDark);

  const handleThemeChange = useCallback(
    (syntaxTheme: string) => {
      updateSettings({ syntaxTheme });
      notifySaved();
    },
    [updateSettings, notifySaved]
  );

  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">Syntax Theme</h2>
      <p className="mt-1.5 mb-6 text-sm text-muted-foreground">
        Pick the palette your SQL reads in.
      </p>
      <div className="grid grid-cols-3 gap-3">
        {visibleThemes.map((entry) => (
          <ThemePreviewCard
            fontFamily={settings.fontFamily}
            fontSize={settings.fontSize}
            isSelected={effectiveTheme === entry.key}
            key={entry.key}
            label={entry.label}
            onSelect={handleThemeChange}
            themeKey={entry.key}
          />
        ))}
      </div>
    </section>
  );
};
