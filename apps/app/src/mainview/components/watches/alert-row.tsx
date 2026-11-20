import { timeAgo } from "@oh-my-query/rpc";
import { useCallback, useState } from "react";

import { LauncherRow } from "@/components/launcher/launcher-row";
import { FreshPulse } from "@/components/motion/fresh-pulse";
import { useNow } from "@/hooks/use-now";

import type { RootAlert } from "./use-alerts";

import { WatchGlyph } from "./watch-glyph";

const pulsed = new Set<string>();

export const resetPulsedAlerts = () => pulsed.clear();

const MINUTE_MS = 60_000;

interface AlertRowProps {
  id: string;
  alert: RootAlert;
  selected: boolean;
  onHover: (id: string) => void;
  onRun: (id: string) => void;
}

export function AlertRow({
  id,
  alert,
  selected,
  onHover,
  onRun,
}: AlertRowProps) {
  const now = useNow(MINUTE_MS);
  const pulseKey = `${alert.watchId}:${alert.firedAt}`;
  const [pulsing, setPulsing] = useState(() => !pulsed.has(pulseKey));
  const settle = useCallback(() => {
    pulsed.add(pulseKey);
    setPulsing(false);
  }, [pulseKey]);

  return (
    <LauncherRow id={id} onHover={onHover} onRun={onRun} selected={selected}>
      {pulsing ? <FreshPulse onDone={settle} /> : null}
      <span className="relative grid size-6 place-items-center rounded-[7px] bg-row-hover">
        <WatchGlyph kind="alert" />
      </span>
      <span className="relative flex min-w-0 flex-1 items-baseline gap-2">
        <span className="truncate type-body text-foreground">
          {alert.label}
        </span>
        <span className="shrink-0 type-meta text-panel-muted tabular-nums">
          {timeAgo(Date.parse(alert.firedAt), now)}
        </span>
      </span>
    </LauncherRow>
  );
}
