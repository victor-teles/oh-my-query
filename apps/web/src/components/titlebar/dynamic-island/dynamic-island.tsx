import { motion } from "motion/react";

import { DynamicIslandContent } from "./dynamic-island-content";

const SPRING = { damping: 30, stiffness: 400, type: "spring" } as const;

interface DynamicIslandProps {
  isConnecting: boolean;
  isConnected: boolean;
  isReconnecting: boolean;
  connectionError: string | null;
  connectionName: string;
  serverVersion: string | null;
  username: string;
  database: string;
  onReconnect: () => void;
}

export const DynamicIsland = ({
  isConnecting,
  isConnected,
  isReconnecting,
  connectionError,
  connectionName,
  serverVersion,
  username,
  database,
  onReconnect,
}: DynamicIslandProps) => (
  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
    <motion.div
      layout
      transition={SPRING}
      whileHover={{
        boxShadow:
          "0 0 0 1px color-mix(in oklch, var(--border) 80%, transparent)",
      }}
      className="pointer-events-auto flex h-6 items-center rounded-full border border-border/60 bg-background px-2.5 shadow-sm backdrop-blur-xl backdrop-saturate-200"
    >
      <DynamicIslandContent
        isConnecting={isConnecting}
        isConnected={isConnected}
        isReconnecting={isReconnecting}
        connectionError={connectionError}
        connectionName={connectionName}
        serverVersion={serverVersion}
        username={username}
        database={database}
        onReconnect={onReconnect}
      />
    </motion.div>
  </div>
);
