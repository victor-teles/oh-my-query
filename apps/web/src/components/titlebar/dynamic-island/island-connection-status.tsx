import { AlertCircle } from "lucide-react";
import { motion } from "motion/react";

interface ConnectingStatusProps {
  connectionName: string;
}

const DOT_IDS = ["d1", "d2", "d3"] as const;

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
    className="flex items-center gap-1.5"
    initial={{ filter: "blur(4px)", opacity: 0 }}
    animate={{ filter: "blur(0px)", opacity: 1 }}
    exit={{ filter: "blur(4px)", opacity: 0 }}
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
}

export const ConnectionErrorStatus = ({
  error,
}: ConnectionErrorStatusProps) => (
  <motion.div
    className="flex items-center gap-1.5"
    initial={{ filter: "blur(4px)", opacity: 0 }}
    animate={{ filter: "blur(0px)", opacity: 1 }}
    exit={{ filter: "blur(4px)", opacity: 0 }}
  >
    <AlertCircle className="size-3 shrink-0 text-destructive" />
    <span className="max-w-[160px] truncate text-[0.625rem] text-destructive">
      {error}
    </span>
  </motion.div>
);
