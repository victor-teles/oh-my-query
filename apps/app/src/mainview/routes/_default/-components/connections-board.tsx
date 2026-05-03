import type { RefObject } from "react";

import { LayoutGroup, motion } from "motion/react";

import type { DatabaseConnection } from "@/lib/connections";

import { ConnectionList } from "./connection-list";
import { KeyboardHints } from "./keyboard-hints";

interface ConnectionsBoardProps {
  listboxRef: RefObject<HTMLDivElement | null>;
  pinned: DatabaseConnection[];
  unpinned: DatabaseConnection[];
  selectedId: string | null;
  glowingId: string | null;
  onEditRequest: (connection: DatabaseConnection) => void;
  onDeleteRequest: (connection: DatabaseConnection) => void;
  onTogglePin: (connection: DatabaseConnection) => void;
  onLaunch: (connection: DatabaseConnection) => void;
}

const ConnectionsBoard = ({
  listboxRef,
  pinned,
  unpinned,
  selectedId,
  glowingId,
  onEditRequest,
  onDeleteRequest,
  onTogglePin,
  onLaunch,
}: ConnectionsBoardProps) => (
  <motion.div
    animate={{ opacity: 1 }}
    className="w-full max-w-md"
    exit={{ opacity: 0 }}
    initial={{ opacity: 0 }}
    transition={{ duration: 0.2, ease: "easeOut" }}
  >
    <h1
      className="
        mb-8 px-0.5 text-2xl leading-[1.1] font-medium tracking-tight
        text-foreground
      "
    >
      Your databases
    </h1>

    <LayoutGroup>
      <div
        aria-activedescendant={selectedId ?? undefined}
        aria-label="Database connections"
        className="
          flex flex-col gap-9 rounded-md outline-none
          focus-visible:ring-2 focus-visible:ring-ring
          focus-visible:ring-offset-2 focus-visible:ring-offset-background
        "
        ref={listboxRef}
        role="listbox"
        tabIndex={0}
      >
        {pinned.length > 0 && (
          <section aria-labelledby="connections-pinned-heading">
            <h2
              className="text-section-label mb-3 px-0.5"
              id="connections-pinned-heading"
            >
              Pinned
            </h2>
            <ConnectionList
              connections={pinned}
              glowingId={glowingId}
              onDeleteRequest={onDeleteRequest}
              onEditRequest={onEditRequest}
              onLaunch={onLaunch}
              onTogglePin={onTogglePin}
              selectedId={selectedId}
            />
          </section>
        )}

        {unpinned.length > 0 && (
          <section aria-labelledby="connections-recent-heading">
            <h2
              className="text-section-label mb-3 px-0.5"
              id="connections-recent-heading"
            >
              Recent
            </h2>
            <ConnectionList
              connections={unpinned}
              glowingId={glowingId}
              onDeleteRequest={onDeleteRequest}
              onEditRequest={onEditRequest}
              onLaunch={onLaunch}
              onTogglePin={onTogglePin}
              selectedId={selectedId}
            />
          </section>
        )}
      </div>
    </LayoutGroup>

    <KeyboardHints />
  </motion.div>
);

export { ConnectionsBoard };
