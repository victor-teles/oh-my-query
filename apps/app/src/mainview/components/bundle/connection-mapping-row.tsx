import type { KeyboardEvent } from "react";

import { motion } from "motion/react";
import { useCallback, useMemo } from "react";

import type { DatabaseConnection } from "@/lib/connections";
import type { ConnectionPlan } from "@/lib/ipc";

import { ConnectionGlyph } from "@/components/launcher/connections/connection-glyph";
import { useConnections } from "@/components/launcher/connections/connections-provider";
import { Pressable } from "@/components/motion/pressable";
import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { engineLabel } from "./bundle-labels";

interface MappingOption {
  id: string | null;
  label: string;
}

const optionKey = (id: string | null) => id ?? "skip";
const chipId = (ref: string, id: string | null) =>
  `import-map-${ref}-${optionKey(id)}`;

const STEP: Record<string, 1 | -1> = { ArrowLeft: -1, ArrowRight: 1 };

// React only honors autoFocus on form controls; the group is a div.
const focusOnMount = (node: HTMLDivElement | null) => node?.focus();

interface MappingChipProps {
  bundleRef: string;
  option: MappingOption;
  checked: boolean;
  local: DatabaseConnection | null;
  onMap: (ref: string, connectionId: string | null) => void;
}

function MappingChip({
  bundleRef: ref,
  option,
  checked,
  local,
  onMap,
}: MappingChipProps) {
  const { reduced, snappy } = useMotionPreset();
  const handleClick = useCallback(
    () => onMap(ref, option.id),
    [onMap, option.id, ref]
  );
  return (
    <Pressable
      aria-checked={checked}
      className={cn(
        "relative flex h-7 items-center gap-1.5 rounded-[7px] px-2 type-meta",
        checked ? "text-foreground" : "text-panel-muted hover:text-foreground"
      )}
      id={chipId(ref, option.id)}
      onClick={handleClick}
      role="radio"
      tabIndex={-1}
    >
      {checked ? (
        <motion.span
          className="absolute inset-0 rounded-[7px] bg-row-active"
          layoutId={`import-map-${ref}`}
          transition={reduced ? { duration: 0 } : snappy}
        />
      ) : null}
      {local ? (
        <ConnectionGlyph
          className="relative size-4 rounded-[5px] text-[10px]"
          connection={local}
        />
      ) : null}
      <span className="relative">{option.label}</span>
    </Pressable>
  );
}

interface ConnectionMappingRowProps {
  plan: ConnectionPlan;
  selectedId: string | null;
  autoFocus: boolean;
  onMap: (ref: string, connectionId: string | null) => void;
}

export function ConnectionMappingRow({
  plan,
  selectedId,
  autoFocus,
  onMap,
}: ConnectionMappingRowProps) {
  const { state } = useConnections();
  const { ref, candidates } = plan;
  const options: MappingOption[] = useMemo(
    () => [
      ...candidates.map((item) => ({ id: item.id, label: item.name })),
      { id: null, label: "Skip" },
    ],
    [candidates]
  );
  const engine = engineLabel(plan.type);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const step = STEP[event.key];
      if (!step) {
        return;
      }
      event.preventDefault();
      const at = options.findIndex((option) => option.id === selectedId);
      const next = options[(at + step + options.length) % options.length];
      onMap(ref, next?.id ?? null);
    },
    [onMap, options, ref, selectedId]
  );

  return (
    <div
      aria-activedescendant={chipId(ref, selectedId)}
      aria-label={`${plan.name} · ${engine}`}
      className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[10px] px-2.5 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      data-import-row
      data-row-focus
      onKeyDown={handleKeyDown}
      ref={autoFocus ? focusOnMount : undefined}
      role="radiogroup"
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the group owns focus; ←/→ move its selection
      tabIndex={0}
    >
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="truncate type-body text-foreground">{plan.name}</span>
        <span className="shrink-0 type-meta text-panel-muted">{engine}</span>
      </span>
      <span className="flex flex-wrap items-center gap-1">
        {candidates.length === 0 ? (
          <span className="pr-1 type-meta text-panel-muted">
            No {engine} connection here
          </span>
        ) : null}
        {options.map((option) => (
          <MappingChip
            bundleRef={ref}
            checked={option.id === selectedId}
            key={optionKey(option.id)}
            local={
              state.connections.find((item) => item.id === option.id) ?? null
            }
            onMap={onMap}
            option={option}
          />
        ))}
      </span>
    </div>
  );
}
