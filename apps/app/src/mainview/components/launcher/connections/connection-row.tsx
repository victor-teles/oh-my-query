import { PinIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import type { RowTone } from "@/components/launcher/launcher-row";
import type { DatabaseConnection } from "@/lib/connections";

import { LauncherRow } from "@/components/launcher/launcher-row";
import { SwapText } from "@/components/motion/swap-text";
import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

import type { RowActivity } from "./connections-reducer";

import { ConnectionIdentity } from "./connection-identity";
import { ConnectionIndicator } from "./connection-indicator";
import { connectionSubtitle } from "./connection-search";
import { useConnections } from "./connections-provider";
import { EnvironmentBadge } from "./environment-badge";

const subtitleFor = (
  connection: DatabaseConnection,
  activity: RowActivity | undefined
): string => {
  switch (activity?.kind) {
    case "error": {
      return activity.message;
    }
    case "testing": {
      return "Testing…";
    }
    case "tested": {
      return `Reachable · ${activity.latencyMs} ms`;
    }
    default: {
      return connectionSubtitle(connection);
    }
  }
};

function PinMark({ pinned }: { pinned: boolean }) {
  const { snappy, fadeOut } = useMotionPreset();
  return (
    <AnimatePresence initial={false}>
      {pinned ? (
        <motion.span
          animate={{ opacity: 1, scale: 1 }}
          aria-label="Pinned"
          className="relative grid shrink-0 place-items-center text-panel-muted"
          exit={{ opacity: 0, scale: 0.6, transition: fadeOut }}
          initial={{ opacity: 0, scale: 0.6 }}
          role="img"
          transition={snappy}
        >
          <PinIcon aria-hidden className="size-3" />
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}

interface ConnectionRowProps {
  connection: DatabaseConnection;
  selected: boolean;
  tone?: RowTone;
  onHover: (id: string) => void;
  onRun: (id: string) => void;
}

export function ConnectionRow({
  connection,
  selected,
  tone,
  onHover,
  onRun,
}: ConnectionRowProps) {
  const { state } = useConnections();
  const activity = state.activity[connection.id];
  const subtitle = subtitleFor(connection, activity);

  return (
    <LauncherRow
      id={connection.id}
      onHover={onHover}
      onRun={onRun}
      selected={selected}
      tone={tone}
    >
      <ConnectionIdentity
        className="max-w-[45%] shrink-0"
        connection={connection}
        handoff={activity?.kind === "connecting"}
      />
      <span
        aria-live="polite"
        className={cn(
          "relative min-w-0 flex-1 overflow-hidden type-meta whitespace-nowrap",
          activity?.kind === "error" ? "text-danger-ink" : "text-panel-muted"
        )}
        title={subtitle}
      >
        <SwapText value={subtitle} />
      </span>
      {connection.environment ? (
        <EnvironmentBadge environment={connection.environment} />
      ) : null}
      <PinMark pinned={connection.pinned} />
      <ConnectionIndicator activity={activity} />
    </LauncherRow>
  );
}
