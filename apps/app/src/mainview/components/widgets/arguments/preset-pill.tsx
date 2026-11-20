import type { FocusEvent, KeyboardEvent, ReactNode } from "react";

import { ChevronDownIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useRef, useState } from "react";

import { useMotionPreset } from "@/lib/motion";

import type { PillProps } from "./pill-props";

import { ArgumentPill } from "./argument-pill";
import { PillPopover } from "./pill-popover";
import { usePillTarget } from "./use-pill-target";

export interface PresetOption {
  value: string;
  label: string;
}

interface PresetPillProps {
  base: PillProps;
  display: string;
  presets: readonly PresetOption[];
  custom: ReactNode;
}

const STEPS: Partial<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };

export const stepPreset = (
  selected: number,
  step: number,
  count: number
): number => {
  const from = selected === -1 && step < 0 ? 0 : selected;
  return (from + step + count) % count;
};

interface PresetRowProps {
  preset: PresetOption;
  selected: boolean;
  layoutGroup: string;
  onPick: (value: string) => void;
}

function PresetRow({ preset, selected, layoutGroup, onPick }: PresetRowProps) {
  const { snappy } = useMotionPreset();
  const handleClick = useCallback(() => onPick(preset.value), [onPick, preset]);
  return (
    <motion.div
      aria-selected={selected}
      className="relative flex h-7 cursor-default items-center px-2 type-body text-foreground"
      onClick={handleClick}
      role="option"
    >
      {selected ? (
        <motion.span
          className="absolute inset-0 rounded-[6px] bg-row-active"
          layoutId={layoutGroup}
          transition={snappy}
        />
      ) : null}
      <span className="relative">{preset.label}</span>
    </motion.div>
  );
}

export function PresetPill({
  base,
  display,
  presets,
  custom,
}: PresetPillProps) {
  const { param, value, valueKey, index, active, onChange, onCommit } = base;
  const target = usePillTarget(base);
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const selected = presets.findIndex((preset) => preset.value === value);
  const listId = `arg-presets-${param.name}`;

  const { handleFocus: markActive } = target;
  const handleFocus = useCallback(() => {
    markActive();
    setOpen(true);
  }, [markActive]);
  const handleOpen = useCallback(() => setOpen(true), []);
  const handleBlur = useCallback((event: FocusEvent<HTMLElement>) => {
    if (!popoverRef.current?.contains(event.relatedTarget)) {
      setOpen(false);
    }
  }, []);
  const handlePick = useCallback(
    (preset: string) => {
      setOpen(false);
      onCommit(valueKey, preset);
    },
    [onCommit, valueKey]
  );
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const step = STEPS[event.key];
      if (step !== undefined) {
        event.preventDefault();
        setOpen(true);
        const preset = presets[stepPreset(selected, step, presets.length)];
        if (preset) {
          onChange(valueKey, preset.value);
        }
        return;
      }
      if (event.key === "Escape" && open) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    },
    [onChange, open, presets, selected, valueKey]
  );

  const popover = (
    <AnimatePresence>
      {open ? (
        <PillPopover ref={popoverRef}>
          <div aria-label={`${param.label} presets`} id={listId} role="listbox">
            {presets.map((preset, position) => (
              <PresetRow
                key={preset.value}
                layoutGroup={`${listId}-selection`}
                onPick={handlePick}
                preset={preset}
                selected={position === selected}
              />
            ))}
          </div>
          <div
            className="mt-1 flex items-center gap-1.5 border-t border-panel-border px-1 pt-2 pb-1"
            onBlur={handleBlur}
          >
            {custom}
          </div>
        </PillPopover>
      ) : null}
    </AnimatePresence>
  );

  return (
    <ArgumentPill
      active={active}
      index={index}
      label={param.label}
      popover={popover}
    >
      <button
        aria-controls={listId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${param.label}: ${display}`}
        className="flex items-center gap-1 type-body text-foreground outline-none focus-visible:outline-none"
        onBlur={handleBlur}
        onClick={handleOpen}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        ref={target.ref}
        type="button"
      >
        <span className="max-w-56 truncate">{display}</span>
        <ChevronDownIcon aria-hidden className="size-3 text-panel-muted" />
      </button>
    </ArgumentPill>
  );
}
