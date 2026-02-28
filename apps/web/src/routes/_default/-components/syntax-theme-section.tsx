import { THEME_ENTRIES } from "@/lib/codemirror-themes";

import { ThemePreviewCard } from "./theme-preview-card";

interface SyntaxThemeSectionProps {
  value: string;
  fontFamily: string;
  fontSize: number;
  onChange: (themeKey: string) => void;
}

export const SyntaxThemeSection = ({
  value,
  fontFamily,
  fontSize,
  onChange,
}: SyntaxThemeSectionProps) => (
  <section>
    <h2 className="mb-1 text-sm font-medium">Syntax Theme</h2>
    <p className="mb-4 text-xs text-muted-foreground">
      Choose a color scheme for the SQL editor.
    </p>
    <div className="grid grid-cols-3 gap-3">
      {THEME_ENTRIES.map((entry) => (
        <ThemePreviewCard
          key={entry.key}
          themeKey={entry.key}
          label={entry.label}
          isSelected={value === entry.key}
          fontFamily={fontFamily}
          fontSize={fontSize}
          onSelect={onChange}
        />
      ))}
    </div>
  </section>
);
