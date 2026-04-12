import { useCallback } from "react";

import { useEditorSettings } from "@/hooks/use-editor-settings";
import { THEME_ENTRIES } from "@/lib/codemirror-themes";

import { useSettingsFeedback } from "./settings-feedback-context";
import { ThemePreviewCard } from "./theme-preview-card";

export const SyntaxThemeSection = () => {
  const { settings, updateSettings } = useEditorSettings();
  const { notifySaved } = useSettingsFeedback();

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
        {THEME_ENTRIES.map((entry) => (
          <ThemePreviewCard
            fontFamily={settings.fontFamily}
            fontSize={settings.fontSize}
            isSelected={settings.syntaxTheme === entry.key}
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
