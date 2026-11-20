import { RotateCwIcon } from "lucide-react";

import { Pressable } from "@/components/motion/pressable";
import { Reveal } from "@/components/motion/reveal";
import { SwapText } from "@/components/motion/swap-text";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

import { SettingRow } from "./setting-row";
import { useClipboardLookupSetting } from "./use-clipboard-lookup-setting";

const NOTE =
  "Read only when you open the launcher. Only ids and emails are offered. Nothing is stored.";

export function ClipboardLookupRow() {
  const { change, retry, setting } = useClipboardLookupSetting();
  const saveError = setting.status === "ready" ? setting.error : null;

  return (
    <SettingRow
      description={
        <span aria-live="polite" className={cn(saveError && "text-danger-ink")}>
          <SwapText value={saveError ?? NOTE} />
        </span>
      }
      label="Suggest lookups from the clipboard"
    >
      {setting.status === "loading" ? (
        <span
          aria-label="Loading clipboard setting"
          className="size-4 animate-pulse rounded-[4px] bg-kbd motion-reduce:animate-none"
          role="status"
        />
      ) : null}
      {setting.status === "ready" ? (
        <Checkbox
          aria-label="Suggest lookups from the clipboard"
          checked={setting.enabled}
          disabled={setting.saving}
          onCheckedChange={change}
        />
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
