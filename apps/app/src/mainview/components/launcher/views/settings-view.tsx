import { ChevronRightIcon } from "lucide-react";

import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { ViewHeader } from "@/components/launcher/view-header";
import { Pressable } from "@/components/motion/pressable";

import { AboutSection } from "./settings/about-section";
import { AiSettingsSection } from "./settings/ai-settings-section";
import { ClipboardLookupRow } from "./settings/clipboard-lookup-row";
import { HotkeyRow } from "./settings/hotkey-row";
import { SettingRow } from "./settings/setting-row";
import { SettingsGroup } from "./settings/settings-group";
import { ThemeControl } from "./settings/theme-control";

const BACK_KEYS = ["esc"] as const;
const STATUS = <span>Conch</span>;

interface SettingsViewProps {
  onBack: () => void;
  onOpenWatches: () => void;
}

export function SettingsView({ onBack, onOpenWatches }: SettingsViewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader onBack={onBack} title="Settings" />
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-panel-border pb-2">
        <SettingsGroup title="AI">
          <AiSettingsSection />
        </SettingsGroup>
        <SettingsGroup title="Launcher">
          <HotkeyRow />
          <ClipboardLookupRow />
          <SettingRow
            description="Dark is the default for long sessions."
            label="Appearance"
          >
            <ThemeControl />
          </SettingRow>
        </SettingsGroup>
        <SettingsGroup title="Background">
          <SettingRow
            description="Widgets that refresh on their own, alert you, or sit in the menu bar."
            label="Watching"
          >
            <Pressable
              aria-label="Open watched widgets"
              className="flex h-7 items-center gap-1 rounded-[8px] bg-row-hover px-2.5 type-meta text-foreground hover:bg-row-active focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:outline-none"
              onClick={onOpenWatches}
            >
              Open
              <ChevronRightIcon aria-hidden className="size-3" />
            </Pressable>
          </SettingRow>
        </SettingsGroup>
        <AboutSection />
      </div>
      <LauncherFooter
        actionKeys={BACK_KEYS}
        actionLabel="Back"
        status={STATUS}
      />
    </div>
  );
}
