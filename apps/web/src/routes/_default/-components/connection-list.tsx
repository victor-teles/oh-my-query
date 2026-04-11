import { AnimatePresence, motion } from "motion/react";

import type { DatabaseConnection } from "@/lib/connections";

import { Separator } from "@/components/ui/separator";

import { ConnectionListItem } from "./connection-list-item";

const SPRING = { damping: 30, stiffness: 400, type: "spring" } as const;

const ConnectionList = ({
  connections,
  selectedId,
  glowingId,
  onEditRequest,
  onDeleteRequest,
  onTogglePin,
  onLaunch,
}: {
  connections: DatabaseConnection[];
  selectedId: string | null;
  glowingId?: string | null;
  onEditRequest: (connection: DatabaseConnection) => void;
  onDeleteRequest: (connection: DatabaseConnection) => void;
  onTogglePin: (connection: DatabaseConnection) => void;
  onLaunch: (connection: DatabaseConnection) => void;
}) => (
  <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
    <AnimatePresence initial={false}>
      {connections.map((conn, index) => (
        <motion.div
          key={conn.id}
          layout
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={SPRING}
        >
          {index > 0 && <Separator />}
          <ConnectionListItem
            connection={conn}
            isSelected={selectedId === conn.id}
            isGlowing={glowingId === conn.id}
            onEditRequest={onEditRequest}
            onDeleteRequest={onDeleteRequest}
            onTogglePin={onTogglePin}
            onLaunch={onLaunch}
          />
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

export { ConnectionList };
