import { motion } from "motion/react";
import { useCallback } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { useDelayedVisibility } from "@/hooks/use-delayed-visibility";
import { useMotionPreset } from "@/lib/motion";

import type { ParamOptions } from "./use-param-options";

interface OptionRowProps {
  option: string;
  position: number;
  current: boolean;
  highlighted: boolean;
  layoutGroup: string;
  onChoose: (option: string) => void;
  onHighlight: (position: number) => void;
}

function OptionRow({
  option,
  position,
  current,
  highlighted,
  layoutGroup,
  onChoose,
  onHighlight,
}: OptionRowProps) {
  const { snappy } = useMotionPreset();
  const handleClick = useCallback(() => onChoose(option), [onChoose, option]);
  const handlePointerMove = useCallback(
    () => onHighlight(position),
    [onHighlight, position]
  );
  return (
    <motion.div
      aria-selected={current}
      className="relative flex h-7 cursor-default items-center px-2 type-body text-foreground"
      layout="position"
      onClick={handleClick}
      onPointerMove={handlePointerMove}
      role="option"
      transition={snappy}
    >
      {highlighted ? (
        <motion.span
          className="absolute inset-0 rounded-[6px] bg-row-active"
          layoutId={layoutGroup}
          transition={snappy}
        />
      ) : null}
      <span className="relative truncate">{option}</span>
    </motion.div>
  );
}

interface SelectOptionsProps {
  id: string;
  label: string;
  state: ParamOptions;
  matches: readonly string[];
  selection: { current: string; highlight: number };
  onChoose: (option: string) => void;
  onHighlight: (position: number) => void;
}

export function SelectOptions({
  id,
  label,
  state,
  matches,
  selection,
  onChoose,
  onHighlight,
}: SelectOptionsProps) {
  const showSkeleton = useDelayedVisibility(state.status === "loading");
  return (
    <div aria-label={`${label} options`} id={id} role="listbox">
      {showSkeleton ? <Skeleton className="m-1 h-6 rounded-[6px]" /> : null}
      {state.status === "error" ? (
        <p className="px-2 py-1.5 type-meta text-danger-ink">{state.message}</p>
      ) : null}
      {state.status === "ready" && matches.length === 0 ? (
        <p className="px-2 py-1.5 type-meta text-panel-muted">
          No matching {label.toLowerCase()}
        </p>
      ) : null}
      {matches.map((option, position) => (
        <OptionRow
          current={option === selection.current}
          highlighted={position === selection.highlight}
          key={option}
          layoutGroup={`${id}-highlight`}
          onChoose={onChoose}
          onHighlight={onHighlight}
          option={option}
          position={position}
        />
      ))}
    </div>
  );
}
