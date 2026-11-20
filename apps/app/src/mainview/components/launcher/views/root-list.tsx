import type { ReactNode } from "react";

import { motion } from "motion/react";
import { useCallback } from "react";

import { useConnections } from "@/components/launcher/connections/connections-provider";
import {
  LauncherListbox,
  LauncherSection,
} from "@/components/launcher/launcher-list";
import { LauncherNoResults } from "@/components/launcher/launcher-no-results";
import { RevealWhenChanged } from "@/components/widgets/reveal-when-changed";
import { useWidgets } from "@/components/widgets/widgets-provider";
import { useMotionPreset } from "@/lib/motion";

import type { RootRowContext } from "./root-item-row";
import type { RootItem, RootSection } from "./root-items";

import { ConnectionsLoadState } from "./connections-load-state";
import { FirstRunNote } from "./first-run-note";
import { RootItemRow } from "./root-item-row";

export const ROOT_LIST_ID = "launcher-root-list";

const contentKey = (section: RootSection): string =>
  section.items
    .map((item) => (item.kind === "lookup" ? item.value.value : item.id))
    .join(",");

function SectionEnter({ children }: { children: ReactNode }) {
  const { reduced, spring, fadeIn } = useMotionPreset();
  return (
    <motion.div
      animate={{ opacity: 1 }}
      data-motion={reduced ? "instant" : "fade"}
      initial={{ opacity: reduced ? 1 : 0 }}
      layout="position"
      transition={{ layout: spring, opacity: fadeIn }}
    >
      {children}
    </motion.div>
  );
}

const REVEALED_SECTIONS = new Set<RootSection["id"]>(["recent", "clipboard"]);

const withEntrance = (section: RootSection, group: ReactNode): ReactNode => {
  if (section.id === "lookup") {
    return <SectionEnter key={section.id}>{group}</SectionEnter>;
  }
  return REVEALED_SECTIONS.has(section.id) ? (
    <RevealWhenChanged
      contentKey={contentKey(section)}
      key={section.id}
      slot={section.id}
    >
      {group}
    </RevealWhenChanged>
  ) : (
    group
  );
};

interface RootListProps {
  sections: readonly RootSection[];
  query: string;
  selectedId: string | null;
  armedId: string | null;
  onHover: (id: string) => void;
  onRun: (id: string) => void;
}

export function RootList({
  sections,
  query,
  selectedId,
  armedId,
  onHover,
  onRun,
}: RootListProps) {
  const { state } = useConnections();
  const { freshId, markFresh } = useWidgets();
  const connectionById = (id: string) =>
    state.connections.find((connection) => connection.id === id) ?? null;
  const clearFresh = useCallback(() => markFresh(null), [markFresh]);
  const firstRun =
    state.load.status === "ready" &&
    state.connections.length === 0 &&
    !query.trim();

  const context: RootRowContext = {
    armedId,
    connectionById,
    freshWidgetId: freshId,
    onHover,
    onPulseDone: clearFresh,
    onRun,
    selectedId,
  };
  const renderItem = (item: RootItem) => (
    <RootItemRow context={context} item={item} key={item.id} />
  );

  return (
    <>
      {firstRun ? <FirstRunNote /> : null}
      <ConnectionsLoadState />
      {sections.length > 0 ? (
        <LauncherListbox id={ROOT_LIST_ID} label="Results">
          {sections.map((section) =>
            withEntrance(
              section,
              <LauncherSection key={section.id} label={section.label}>
                {section.items.map(renderItem)}
              </LauncherSection>
            )
          )}
        </LauncherListbox>
      ) : (
        <LauncherNoResults query={query} />
      )}
    </>
  );
}
