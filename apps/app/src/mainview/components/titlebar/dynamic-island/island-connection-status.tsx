import { AlertCircle } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import type { ConnectionColor, ConnectionEnvironment } from "@/lib/connections";

import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  getConnectionColorClasses,
  getEnvironmentStyle,
} from "@/lib/connection-appearance";
import { cn } from "@/lib/utils";

import { IslandErrorMessage } from "./island-error-message";
import {
  INDICATOR_DOT_STAGGER_S,
  INDICATOR_LOOP_TRANSITION,
} from "./island-motion";

interface ConnectingStatusProps {
  connectionName: string;
}

const DOT_IDS = ["d1", "d2", "d3"] as const;

export const ConnectingStatus = ({ connectionName }: ConnectingStatusProps) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <>
      <div aria-hidden="true" className="flex items-center gap-0.5">
        {DOT_IDS.map((id, i) => (
          <motion.span
            animate={shouldReduceMotion ? undefined : { opacity: [0.3, 1] }}
            className="size-1 rounded-full bg-muted-foreground"
            key={id}
            transition={INDICATOR_LOOP_TRANSITION(i * INDICATOR_DOT_STAGGER_S)}
          />
        ))}
      </div>
      <span className="sr-only">Connecting to </span>
      <span className={cn(`
            max-w-60 truncate text-xs font-medium tracking-tight
            text-muted-foreground
          `, shouldReduceMotion && "font-semibold")}>{connectionName}</span>
    </>
  );
};

export const ReconnectingStatus = ({
  connectionName,
}: ConnectingStatusProps) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <>
      <div aria-hidden="true" className="flex items-center gap-0.5">
        {DOT_IDS.map((id, i) => (
          <motion.span
            animate={shouldReduceMotion ? undefined : { opacity: [0.3, 1] }}
            className="size-1 rounded-full bg-warning"
            key={id}
            transition={INDICATOR_LOOP_TRANSITION(i * INDICATOR_DOT_STAGGER_S)}
          />
        ))}
      </div>
      <span
        className={cn(
          "max-w-65 truncate text-xs font-medium tracking-tight text-warning",
          shouldReduceMotion && "font-semibold"
        )}
      >
        Reconnecting to {connectionName}
      </span>
    </>
  );
};

interface ConnectedIdleStatusProps {
  connectionName: string;
  serverVersion: string | null;
  username: string;
  database: string;
  color: ConnectionColor | undefined;
  emoji: string | undefined;
  environment: ConnectionEnvironment | undefined;
}

export const ConnectedIdleStatus = ({
  connectionName,
  serverVersion,
  username,
  database,
  color,
  emoji,
  environment,
}: ConnectedIdleStatusProps) => {
  const shouldReduceMotion = useReducedMotion();
  const colorClasses = getConnectionColorClasses(color);
  const envStyle = getEnvironmentStyle(environment);
  const dotClass = colorClasses?.dot ?? "bg-success";
  const srLabel = `Connected to ${connectionName}${
    environment ? ` (${environment})` : ""
  } — ${username}@${database}${
    serverVersion ? ` on ${serverVersion}` : ""
  }. Open connection details.`;

  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <button
            aria-label={srLabel}
            className="
              flex items-center gap-1.5 rounded-full transition-opacity
              duration-150 ease-out
              hover:opacity-75
              focus-visible:ring-2 focus-visible:ring-ring/50
              focus-visible:outline-none
            "
            type="button"
          >
            <span aria-hidden="true" className="relative flex size-2 shrink-0">
              {!shouldReduceMotion && (
                <motion.span
                  animate={{ opacity: 0, scale: 2.2 }}
                  className={cn(
                    "absolute inline-flex size-full rounded-full",
                    dotClass
                  )}
                  initial={{ opacity: 0.5, scale: 1 }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
              <span
                className={cn(
                  "relative inline-flex size-2 rounded-full",
                  dotClass
                )}
              />
            </span>
            {envStyle && (
              <Badge
                className={cn("h-4 px-1.5 text-[10px]", envStyle.badgeClass)}
                variant="outline"
              >
                {envStyle.label}
              </Badge>
            )}
            {emoji && (
              <span
                aria-hidden="true"
                className="text-xs leading-none font-medium tracking-tight"
              >
                {emoji}
              </span>
            )}
            <span
              aria-hidden="true"
              className="
                max-w-40 truncate text-xs font-medium tracking-tight
                text-muted-foreground
              "
            >
              {connectionName}
            </span>
            {serverVersion && (
              <span
                aria-hidden="true"
                className="
                  text-xs font-medium tracking-tight text-muted-foreground
                  tabular-nums
                "
              >
                {serverVersion}
              </span>
            )}
            <span
              aria-hidden="true"
              className="
                text-xs font-medium tracking-tight text-muted-foreground/30
              "
            >
              ·
            </span>
            <span
              aria-hidden="true"
              className="
                text-xs font-medium tracking-tight text-muted-foreground
              "
            >
              {username}@{database}
            </span>
          </button>
        }
      />
      <HoverCardContent align="center" className="w-64">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn("size-1.5 rounded-full", dotClass)}
              />
              <span className="text-section-label">Connected</span>
            </div>
            {envStyle && (
              <Badge
                className={cn("h-4 px-1.5 text-[10px]", envStyle.badgeClass)}
                variant="outline"
              >
                {envStyle.label}
              </Badge>
            )}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
            <dt className="text-muted-foreground">Connection</dt>
            <dd className="truncate text-foreground">
              {emoji ? `${emoji} ` : ""}
              {connectionName}
            </dd>
            <dt className="text-muted-foreground">Database</dt>
            <dd className="text-data text-foreground">{database}</dd>
            <dt className="text-muted-foreground">User</dt>
            <dd className="text-data text-foreground">{username}</dd>
            {serverVersion && (
              <>
                <dt className="text-muted-foreground">Version</dt>
                <dd className="text-data text-foreground">{serverVersion}</dd>
              </>
            )}
          </dl>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

interface ConnectionErrorStatusProps {
  error: string;
  onReconnect: () => void;
}

export const ConnectionErrorStatus = ({
  error,
  onReconnect,
}: ConnectionErrorStatusProps) => (
  <>
    <AlertCircle
      aria-hidden="true"
      className="size-3 shrink-0 text-destructive"
    />
    <IslandErrorMessage error={error} maxWidthClass="max-w-[280px]" />
    <button
      aria-label="Retry connection"
      className="
        cursor-pointer rounded-sm text-xs font-medium tracking-tight
        text-destructive underline underline-offset-2 transition-opacity
        duration-150 ease-out
        hover:opacity-70
        focus-visible:ring-2 focus-visible:ring-ring/50
        focus-visible:outline-none
        active:opacity-50
      "
      onClick={onReconnect}
      type="button"
    >
      Retry
    </button>
  </>
);

interface AmbientStatusProps {
  connectionName: string;
}

export const AmbientStatus = ({ connectionName }: AmbientStatusProps) => (
  <>
    <span
      aria-hidden="true"
      className="size-1 shrink-0 rounded-full bg-muted-foreground/40"
    />
    <span className="sr-only">Database: </span>
    <span
      className="
        max-w-60 truncate text-xs font-medium tracking-tight
        text-muted-foreground
      "
    >
      {connectionName}
    </span>
  </>
);

export const WelcomeStatus = () => (
  <>
    <span
      aria-hidden="true"
      className="size-1.5 shrink-0 rounded-full bg-primary"
    />
    <span className="text-xs font-medium tracking-tight text-muted-foreground">
      Welcome
    </span>
  </>
);
