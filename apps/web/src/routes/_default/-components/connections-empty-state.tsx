import { motion } from "motion/react";

import type { DatabaseConnection } from "@/lib/connections";

import { ConnectionForm } from "@/components/connection-form";

interface ConnectionsEmptyStateProps {
  onSuccess: (connection: DatabaseConnection) => void;
}

const ConnectionsEmptyState = ({ onSuccess }: ConnectionsEmptyStateProps) => (
  <motion.div
    animate={{ opacity: 1 }}
    className="w-full max-w-md"
    exit={{ opacity: 0 }}
    initial={{ opacity: 0 }}
    transition={{ duration: 0.2, ease: "easeOut" }}
  >
    <h1 className="px-0.5 text-2xl font-medium leading-[1.1] tracking-tight text-foreground">
      Connect your first database
    </h1>
    <p className="mb-8 mt-3 px-0.5 text-sm leading-relaxed text-muted-foreground">
      Works with Postgres, MySQL, SQLite, MongoDB, Redis, and ClickHouse — with
      an AI that knows your schema.
    </p>
    <ConnectionForm onSuccess={onSuccess} />
  </motion.div>
);

export { ConnectionsEmptyState };
