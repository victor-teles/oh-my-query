import { motion } from "motion/react";

import { DynamicIslandContent } from "./dynamic-island-content";

const SPRING = { damping: 30, stiffness: 400, type: "spring" } as const;

interface DynamicIslandProps {
  isConnecting: boolean;
  isConnected: boolean;
  connectionError: string | null;
  connectionName: string;
  serverVersion: string | null;
  username: string;
  database: string;
}

export const DynamicIsland = ({
  isConnecting,
  isConnected,
  connectionError,
  connectionName,
  serverVersion,
  username,
  database,
}: DynamicIslandProps) => (
  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
    <motion.div
      layout
      transition={SPRING}
      className="pointer-events-auto flex h-6 items-center rounded-full border border-border/60 bg-secondary/50 px-2.5 shadow-sm backdrop-blur-xl backdrop-saturate-200"
    >
      <DynamicIslandContent
        isConnecting={isConnecting}
        isConnected={isConnected}
        connectionError={connectionError}
        connectionName={connectionName}
        serverVersion={serverVersion}
        username={username}
        database={database}
      />
    </motion.div>
  </div>
);
