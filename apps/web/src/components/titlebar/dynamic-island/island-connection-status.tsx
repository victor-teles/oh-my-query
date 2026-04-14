import { AlertCircle } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

import { IslandErrorMessage } from "./island-error-message";
import { ISLAND_ITEM_TRANSITION, ISLAND_ITEM_VARIANTS } from "./island-motion";

interface ConnectingStatusProps {
  connectionName: string;
}

const DOT_IDS = ["d1", "d2", "d3"] as const;

export const ConnectingStatus = ({ connectionName }: ConnectingStatusProps) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <>
      <motion.div
        aria-hidden="true"
        className="flex items-center gap-0.5"
        transition={ISLAND_ITEM_TRANSITION}
        variants={ISLAND_ITEM_VARIANTS}
      >
        {DOT_IDS.map((id, i) => (
          <motion.span
            animate={
              shouldReduceMotion ? undefined : { opacity: [0.3, 1, 0.3] }
            }
            className="size-1 rounded-full bg-muted-foreground"
            key={id}
            transition={{
              delay: i * 0.2,
              duration: 1.2,
              ease: "easeInOut",
              repeat: Infinity,
            }}
          />
        ))}
      </motion.div>
      <span className="sr-only">Connecting to </span>
      <motion.span
        className="text-chrome max-w-60 truncate text-muted-foreground"
        transition={ISLAND_ITEM_TRANSITION}
        variants={ISLAND_ITEM_VARIANTS}
      >
        {connectionName}
      </motion.span>
    </>
  );
};

export const ReconnectingStatus = ({
  connectionName,
}: ConnectingStatusProps) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <>
      <motion.div
        aria-hidden="true"
        className="flex items-center gap-0.5"
        transition={ISLAND_ITEM_TRANSITION}
        variants={ISLAND_ITEM_VARIANTS}
      >
        {DOT_IDS.map((id, i) => (
          <motion.span
            animate={
              shouldReduceMotion ? undefined : { opacity: [0.3, 1, 0.3] }
            }
            className="size-1 rounded-full bg-warning"
            key={id}
            transition={{
              delay: i * 0.15,
              duration: 1,
              ease: "easeInOut",
              repeat: Infinity,
            }}
          />
        ))}
      </motion.div>
      <motion.span
        className="text-chrome max-w-65 truncate text-warning"
        transition={ISLAND_ITEM_TRANSITION}
        variants={ISLAND_ITEM_VARIANTS}
      >
        Reconnecting to {connectionName}
      </motion.span>
    </>
  );
};

interface ConnectedIdleStatusProps {
  connectionName: string;
  serverVersion: string | null;
  username: string;
  database: string;
}

export const ConnectedIdleStatus = ({
  connectionName,
  serverVersion,
  username,
  database,
}: ConnectedIdleStatusProps) => {
  const shouldReduceMotion = useReducedMotion();
  const srLabel = `Connected to ${connectionName} — ${username}@${database}${
    serverVersion ? ` on ${serverVersion}` : ""
  }. Open connection details.`;

  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <motion.button
            aria-label={srLabel}
            className="flex items-center gap-1.5 rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            transition={ISLAND_ITEM_TRANSITION}
            type="button"
            variants={ISLAND_ITEM_VARIANTS}
            whileHover={{ opacity: 0.75 }}
          >
            <span aria-hidden="true" className="relative flex size-2 shrink-0">
              {!shouldReduceMotion && (
                <motion.span
                  animate={{ opacity: 0, scale: 2.2 }}
                  className="absolute inline-flex size-full rounded-full bg-success"
                  initial={{ opacity: 0.5, scale: 1 }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            {serverVersion && (
              <span
                aria-hidden="true"
                className="text-data text-[11px] text-muted-foreground"
              >
                {serverVersion}
              </span>
            )}
            <span
              aria-hidden="true"
              className="text-[11px] text-muted-foreground/30"
            >
              ·
            </span>
            <span
              aria-hidden="true"
              className="text-data text-[11px] text-muted-foreground"
            >
              {username}@{database}
            </span>
          </motion.button>
        }
      />
      <HoverCardContent align="center" className="w-64">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-success"
            />
            <span className="text-section-label">Connected</span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
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
    <motion.span
      aria-hidden="true"
      transition={ISLAND_ITEM_TRANSITION}
      variants={ISLAND_ITEM_VARIANTS}
    >
      <AlertCircle className="size-3 shrink-0 text-destructive" />
    </motion.span>
    <IslandErrorMessage error={error} maxWidthClass="max-w-[280px]" />
    <motion.button
      aria-label="Retry connection"
      className="text-chrome cursor-pointer rounded-sm text-destructive underline underline-offset-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      onClick={onReconnect}
      transition={ISLAND_ITEM_TRANSITION}
      type="button"
      variants={ISLAND_ITEM_VARIANTS}
      whileHover={{ opacity: 0.7 }}
      whileTap={{ opacity: 0.5 }}
    >
      Retry
    </motion.button>
  </>
);

interface AmbientStatusProps {
  connectionName: string;
}

export const AmbientStatus = ({ connectionName }: AmbientStatusProps) => (
  <>
    <motion.span
      aria-hidden="true"
      className="size-1 shrink-0 rounded-full bg-muted-foreground/40"
      transition={ISLAND_ITEM_TRANSITION}
      variants={ISLAND_ITEM_VARIANTS}
    />
    <span className="sr-only">Database: </span>
    <motion.span
      className="text-chrome max-w-60 truncate text-muted-foreground"
      transition={ISLAND_ITEM_TRANSITION}
      variants={ISLAND_ITEM_VARIANTS}
    >
      {connectionName}
    </motion.span>
  </>
);

export const WelcomeStatus = () => (
  <>
    <motion.span
      aria-hidden="true"
      className="size-1.5 shrink-0 rounded-full bg-primary"
      transition={ISLAND_ITEM_TRANSITION}
      variants={ISLAND_ITEM_VARIANTS}
    />
    <motion.span
      className="text-chrome text-muted-foreground"
      transition={ISLAND_ITEM_TRANSITION}
      variants={ISLAND_ITEM_VARIANTS}
    >
      Welcome
    </motion.span>
  </>
);
