import { useHotkey } from "@tanstack/react-hotkeys";

import type { SettingsSectionId } from "@/routes/_default/-components/settings-sidebar";

import { SETTINGS_SECTIONS } from "@/routes/_default/-components/settings-sidebar";

interface SettingsHotkeysInput {
  onSelectSection: (id: SettingsSectionId) => void;
  onClose: () => void;
}

const [
  APPEARANCE_SECTION,
  SYNTAX_THEME_SECTION,
  CODE_FONT_SECTION,
  EXPORT_SECTION,
  UPDATES_SECTION,
] = SETTINGS_SECTIONS;

export const useSettingsHotkeys = ({
  onSelectSection,
  onClose,
}: SettingsHotkeysInput) => {
  useHotkey("Escape", () => {
    onClose();
  });

  useHotkey("Mod+W", () => {
    onClose();
  });

  useHotkey("Mod+1", () => {
    onSelectSection(APPEARANCE_SECTION.id);
  });

  useHotkey("Mod+2", () => {
    onSelectSection(SYNTAX_THEME_SECTION.id);
  });

  useHotkey("Mod+3", () => {
    onSelectSection(CODE_FONT_SECTION.id);
  });

  useHotkey("Mod+4", () => {
    onSelectSection(EXPORT_SECTION.id);
  });

  useHotkey("Mod+5", () => {
    onSelectSection(UPDATES_SECTION.id);
  });
};
