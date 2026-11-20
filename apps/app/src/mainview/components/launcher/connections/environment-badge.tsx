import type { ConnectionEnvironment } from "@/lib/connections";

import { cn } from "@/lib/utils";

const TONES: Record<ConnectionEnvironment, string> = {
  dev: "bg-row-hover text-panel-muted",
  prod: "bg-destructive/14 text-danger-ink",
  staging: "bg-warning/16 text-foreground",
};

interface EnvironmentBadgeProps {
  environment: ConnectionEnvironment;
}

export function EnvironmentBadge({ environment }: EnvironmentBadgeProps) {
  return (
    <span
      className={cn(
        "relative shrink-0 rounded-[5px] px-1.5 py-px type-micro",
        TONES[environment]
      )}
    >
      {environment}
    </span>
  );
}
