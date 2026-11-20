import { useCallback } from "react";

import { Pressable } from "@/components/motion/pressable";
import { SwapText } from "@/components/motion/swap-text";
import { useDelayedVisibility } from "@/hooks/use-delayed-visibility";
import { cn } from "@/lib/utils";

import type { UpdateCheck } from "./use-update-check";

import { SettingRow } from "./setting-row";
import { useUpdateCheck } from "./use-update-check";

const BUTTON = "h-7 rounded-[8px] px-3 type-meta text-foreground";

const describe = (check: UpdateCheck, showBusy: boolean): string => {
  switch (check.status) {
    case "checking": {
      return showBusy ? "Checking…" : "Downloads from the selected channel.";
    }
    case "current": {
      return "You're on the latest version.";
    }
    case "available": {
      return `Version ${check.update.version} is ready to install.`;
    }
    case "installing": {
      return `Installing ${check.update.version}…`;
    }
    case "failed": {
      return check.message;
    }
    default: {
      return "Downloads from the selected channel.";
    }
  }
};

export function UpdateCheckRow() {
  const { check, install, run } = useUpdateCheck();
  const showBusy = useDelayedVisibility(check.status === "checking");
  const handleInstall = useCallback(() => {
    if (check.status === "available") {
      install(check.update);
    }
  }, [check, install]);

  const available = check.status === "available";

  return (
    <SettingRow
      description={
        <span
          aria-live="polite"
          className={cn(check.status === "failed" && "text-danger-ink")}
        >
          <SwapText value={describe(check, showBusy)} />
        </span>
      }
      label="Updates"
    >
      <Pressable
        className={cn(
          BUTTON,
          available ? "bg-primary text-primary-foreground" : "bg-row-hover"
        )}
        disabled={check.status === "checking" || check.status === "installing"}
        onClick={available ? handleInstall : run}
      >
        {available ? "Install and Restart" : "Check Now"}
      </Pressable>
    </SettingRow>
  );
}
