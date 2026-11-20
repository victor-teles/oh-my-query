import type { SegmentOption } from "@/components/ui/segmented-control";
import type { UpdateChannel } from "@/lib/ipc";

import { SwapText } from "@/components/motion/swap-text";
import { SegmentedControl } from "@/components/ui/segmented-control";

import { SettingRow } from "./setting-row";
import { SettingsGroup } from "./settings-group";
import { UpdateCheckRow } from "./update-check-row";
import { useAboutInfo } from "./use-about-info";

const CHANNELS: readonly SegmentOption<UpdateChannel>[] = [
  { label: "Stable", value: "stable" },
  { label: "Beta", value: "beta" },
  { label: "Nightly", value: "nightly" },
];

export function AboutSection() {
  const { version, channel, changeChannel } = useAboutInfo();

  return (
    <SettingsGroup title="About">
      <SettingRow description="The build you are running." label="Version">
        <SwapText
          className="font-mono text-[12px] text-panel-muted"
          value={version ?? "—"}
        />
      </SettingRow>
      <SettingRow
        description="Beta and Nightly get changes sooner, with rougher edges."
        label="Update channel"
      >
        {channel ? (
          <SegmentedControl
            label="Update channel"
            onChange={changeChannel}
            options={CHANNELS}
            value={channel}
          />
        ) : null}
      </SettingRow>
      <UpdateCheckRow />
    </SettingsGroup>
  );
}
