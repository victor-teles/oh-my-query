import type { KeyboardEvent } from "react";

import { motion } from "motion/react";
import { useCallback, useId } from "react";

import { Pressable } from "@/components/motion/pressable";
import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
  label: string;
  value: T;
}

const ARROW_STEPS: Partial<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
};

interface SegmentProps<T extends string> {
  option: SegmentOption<T>;
  checked: boolean;
  thumbId: string;
  onSelect: (value: T) => void;
}

function Segment<T extends string>({
  option,
  checked,
  thumbId,
  onSelect,
}: SegmentProps<T>) {
  const { snappy } = useMotionPreset();
  const handleClick = useCallback(
    () => onSelect(option.value),
    [onSelect, option.value]
  );

  return (
    <Pressable
      aria-checked={checked}
      className={cn(
        "relative h-7 rounded-[7px] px-3 type-meta",
        checked ? "text-foreground" : "text-panel-muted"
      )}
      data-segment={option.value}
      onClick={handleClick}
      role="radio"
      tabIndex={checked ? 0 : -1}
    >
      {checked ? (
        <motion.span
          className="absolute inset-0 rounded-[7px] bg-control-thumb shadow-sm"
          layoutId={thumbId}
          transition={snappy}
        />
      ) : null}
      <span className="relative">{option.label}</span>
    </Pressable>
  );
}

interface SegmentedControlProps<T extends string> {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const thumbId = useId();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const step = ARROW_STEPS[event.key];
      if (step === undefined) {
        return;
      }
      event.preventDefault();
      const index = options.findIndex((option) => option.value === value);
      const next = options[(index + step + options.length) % options.length];
      if (!next) {
        return;
      }
      onChange(next.value);
      event.currentTarget
        .querySelector<HTMLElement>(`[data-segment="${next.value}"]`)
        ?.focus();
    },
    [onChange, options, value]
  );

  return (
    <div
      aria-label={label}
      className="flex rounded-[9px] bg-row-hover p-0.5"
      onKeyDown={handleKeyDown}
      role="radiogroup"
    >
      {options.map((option) => (
        <Segment
          checked={option.value === value}
          key={option.value}
          onSelect={onChange}
          option={option}
          thumbId={thumbId}
        />
      ))}
    </div>
  );
}
