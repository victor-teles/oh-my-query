import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { motion } from "motion/react";

export const QueryRunningStatus = () => (
  <motion.div
    className="flex items-center gap-1.5"
    initial={{ filter: "blur(4px)", opacity: 0 }}
    animate={{ filter: "blur(0px)", opacity: 1 }}
    exit={{ filter: "blur(4px)", opacity: 0 }}
  >
    <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" />
    <span className="text-[0.625rem] text-muted-foreground">Executing...</span>
  </motion.div>
);

interface QuerySuccessStatusProps {
  rowCount: number;
  executionTimeMs: number;
}

const formatTime = (ms: number): string => {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
};

export const QuerySuccessStatus = ({
  rowCount,
  executionTimeMs,
}: QuerySuccessStatusProps) => (
  <motion.div
    className="flex items-center gap-1.5"
    initial={{ filter: "blur(4px)", opacity: 0 }}
    animate={{ filter: "blur(0px)", opacity: 1 }}
    exit={{ filter: "blur(4px)", opacity: 0 }}
  >
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ damping: 15, delay: 0.1, stiffness: 500, type: "spring" }}
    >
      <Check className="size-3 shrink-0 text-emerald-500" />
    </motion.div>
    <span className="text-[0.625rem] text-muted-foreground">
      {rowCount} {rowCount === 1 ? "row" : "rows"} ·{" "}
      {formatTime(executionTimeMs)}
    </span>
  </motion.div>
);

interface QueryErrorStatusProps {
  error: string;
}

export const QueryErrorStatus = ({ error }: QueryErrorStatusProps) => (
  <motion.div
    className="flex items-center gap-1.5"
    initial={{ filter: "blur(4px)", opacity: 0 }}
    animate={{ filter: "blur(0px)", opacity: 1 }}
    exit={{ filter: "blur(4px)", opacity: 0 }}
  >
    <AlertTriangle className="size-3 shrink-0 text-amber-500" />
    <span className="max-w-[360px] truncate text-[0.625rem] text-amber-500">
      {error}
    </span>
  </motion.div>
);
