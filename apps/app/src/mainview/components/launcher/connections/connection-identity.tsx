import { motion } from "motion/react";

import type { DatabaseConnection } from "@/lib/connections";

import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { ConnectionGlyph } from "./connection-glyph";

export const handoffLayoutId = (connectionId: string) =>
  `active-connection-${connectionId}`;

interface ConnectionIdentityProps {
  connection: DatabaseConnection;
  handoff: boolean;
  className?: string;
}

// The glyph + name pair is the object that travels into the input chip, so
// the row and the chip render it at the same size and only position animates.
export function ConnectionIdentity({
  connection,
  handoff,
  className,
}: ConnectionIdentityProps) {
  const { spring } = useMotionPreset();
  const classes = cn("relative flex min-w-0 items-center gap-3", className);
  const content = (
    <>
      <ConnectionGlyph connection={connection} />
      <span className="truncate type-body text-foreground">
        {connection.name}
      </span>
    </>
  );

  if (!handoff) {
    return <span className={classes}>{content}</span>;
  }
  return (
    <motion.span
      className={classes}
      layout="position"
      layoutId={handoffLayoutId(connection.id)}
      transition={spring}
    >
      {content}
    </motion.span>
  );
}
