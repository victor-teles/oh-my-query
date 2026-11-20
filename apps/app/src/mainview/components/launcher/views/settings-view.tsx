import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { ViewHeader } from "@/components/launcher/view-header";

import { AboutSection } from "./settings/about-section";
import { AiSettingsSection } from "./settings/ai-settings-section";
import { ClipboardLookupRow } from "./settings/clipboard-lookup-row";
import { HotkeyRow } from "./settings/hotkey-row";
import { SettingRow } from "./settings/setting-row";
import { SettingsGroup } from "./settings/settings-group";
import { ThemeControl } from "./settings/theme-control";

const BACK_KEYS = ["esc"] as const;
const STATUS = <span>oh-my-query</span>;

interface SettingsViewProps {
  onBack: () => void;
}

export function SettingsView({ onBack }: SettingsViewProps) {
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
