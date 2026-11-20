import { RotateCwIcon } from "lucide-react";

import { KeyCombo } from "@/components/launcher/key-combo";
import { Pressable } from "@/components/motion/pressable";
import { Reveal } from "@/components/motion/reveal";
import { formatAccelerator } from "@/lib/format-accelerator";

import { SettingRow } from "./setting-row";
import { useLauncherHotkeySetting } from "./use-launcher-hotkey-setting";

export function HotkeyRow() {
  const { retry, setting } = useLauncherHotkeySetting();

  return (
    <SettingRow
      description="Summons the launcher from any app."
      label="Launcher hotkey"
    >
      {setting.status === "loading" ? (
        <span
          aria-label="Loading hotkey"
          className="h-5 w-24 animate-pulse rounded-[5px] bg-kbd motion-reduce:animate-none"
          role="status"
        />
      ) : null}
      {setting.status === "ready" ? (
        <Reveal>
          <KeyCombo keys={formatAccelerator(setting.accelerator)} />
        </Reveal>
      ) : null}
      {setting.status === "error" ? (
        <Reveal className="flex items-center gap-2">
          <span className="type-meta text-destructive" role="alert">
            {setting.message}
          </span>
          <Pressable
            className="flex h-7 items-center gap-1.5 rounded-[8px] bg-row-hover px-2.5 type-meta text-foreground"
            onClick={retry}
          >
            <RotateCwIcon aria-hidden className="size-3" />
            Retry
          </Pressable>
        </Reveal>
      ) : null}
    </SettingRow>
  );
}
