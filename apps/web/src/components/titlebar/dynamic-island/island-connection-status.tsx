import { AlertCircle } from "lucide-react";
import { motion } from "motion/react";

interface ConnectingStatusProps {
  connectionName: string;
}

const DOT_IDS = ["d1", "d2", "d3"] as const;

const BUTTON_SPRING = { damping: 20, stiffness: 400, type: "spring" } as const;

export const ConnectingStatus = ({ connectionName }: ConnectingStatusProps) => (
  <motion.div
    className="flex items-center gap-1.5"
    initial={{ filter: "blur(4px)", opacity: 0 }}
    animate={{ filter: "blur(0px)", opacity: 1 }}
    exit={{ filter: "blur(4px)", opacity: 0 }}
  >
    <div className="flex items-center gap-0.5">
      {DOT_IDS.map((id, i) => (
        <motion.span
          key={id}
          className="size-1 rounded-full bg-muted-foreground"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            delay: i * 0.2,
            duration: 1.2,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />
      ))}
    </div>
    <span className="text-[0.625rem] text-muted-foreground">
      {connectionName}
    </span>
  </motion.div>
);

export const ReconnectingStatus = ({
  connectionName,
}: ConnectingStatusProps) => (
  <motion.div
    className="flex items-center gap-1.5"
    initial={{ filter: "blur(4px)", opacity: 0 }}
    animate={{ filter: "blur(0px)", opacity: 1 }}
    exit={{ filter: "blur(4px)", opacity: 0 }}
  >
    <div className="flex items-center gap-0.5">
      {DOT_IDS.map((id, i) => (
        <motion.span
          key={id}
          className="size-1 rounded-full bg-amber-400"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            delay: i * 0.15,
            duration: 1,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />
      ))}
    </div>
    <span className="text-[0.625rem] text-amber-500">
      Reconnecting to {connectionName}…
    </span>
  </motion.div>
);

interface ConnectedIdleStatusProps {
  serverVersion: string | null;
  username: string;
  database: string;
}

export const ConnectedIdleStatus = ({
  serverVersion,
  username,
  database,
}: ConnectedIdleStatusProps) => (
  <motion.div
    className="flex cursor-default items-center gap-1.5"
    initial={{ filter: "blur(4px)", opacity: 0 }}
    animate={{ filter: "blur(0px)", opacity: 1 }}
    exit={{ filter: "blur(4px)", opacity: 0 }}
    whileHover={{ opacity: 0.75 }}
    transition={BUTTON_SPRING}
  >
    <span className="relative flex size-2 shrink-0">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-50" />
      <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
    </span>
    {serverVersion && (
      <span className="text-[0.625rem] text-muted-foreground">
        {serverVersion}
      </span>
    )}
    <span className="text-[0.625rem] text-muted-foreground/40">|</span>
    <span className="text-[0.625rem] text-muted-foreground">
      {username}@{database}
    </span>
  </motion.div>
);

interface ConnectionErrorStatusProps {
  error: string;
  onReconnect: () => void;
}

export const ConnectionErrorStatus = ({
  error,
  onReconnect,
}: ConnectionErrorStatusProps) => (
  <motion.div
    className="flex items-center gap-1.5"
    initial={{ filter: "blur(4px)", opacity: 0 }}
    animate={{ filter: "blur(0px)", opacity: 1 }}
    exit={{ filter: "blur(4px)", opacity: 0 }}
  >
    <AlertCircle className="size-3 shrink-0 text-destructive" />
    <span className="max-w-[140px] truncate text-[0.625rem] text-destructive">
      {error}
    </span>
    <motion.button
      type="button"
      onClick={onReconnect}
      className="cursor-pointer text-[0.625rem] text-destructive underline underline-offset-2"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.92 }}
      transition={BUTTON_SPRING}
    >
      Retry
    </motion.button>
  </motion.div>
);
