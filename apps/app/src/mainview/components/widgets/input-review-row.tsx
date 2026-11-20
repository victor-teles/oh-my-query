import type { ChangeEvent, KeyboardEvent } from "react";

import { XIcon } from "lucide-react";
import { motion } from "motion/react";
import { useCallback } from "react";

import type { ParamDef, ParamValue } from "@/lib/ipc";

import { Pressable } from "@/components/motion/pressable";
import { staggerDelay, useMotionPreset } from "@/lib/motion";

import type { PillProps } from "./arguments/pill-props";

import { DatePill, DateRangePill } from "./arguments/date-pills";
import { NumberPill, TextPill } from "./arguments/field-pill";
import { PARAM_TYPE_LABELS } from "./param-labels";

const DefaultEditor = ({ param, ...props }: PillProps) => {
  switch (param.type) {
    case "dateRange": {
      return <DateRangePill {...props} param={param} />;
    }
    case "date": {
      return <DatePill {...props} param={param} />;
    }
    case "number": {
      return <NumberPill {...props} param={param} />;
    }
    case "select": {
      return (
        <TextPill
          {...props}
          param={{
            default: param.default,
            label: param.label,
            name: param.name,
            type: "text",
          }}
        />
      );
    }
    default: {
      return <TextPill {...props} param={param} />;
    }
  }
};

// Review rows are reached with Tab, not the pill cycling of the run row.
const skipRegistration = (): void => undefined;
const skipFocusTracking = (): void => undefined;

interface InputReviewRowProps {
  param: ParamDef;
  index: number;
  onLabel: (name: string, label: string) => void;
  onDefault: (name: string, value: ParamValue) => void;
  onRemove: (name: string) => void;
}

export function InputReviewRow({
  param,
  index,
  onLabel,
  onDefault,
  onRemove,
}: InputReviewRowProps) {
  const { reduced, spring, fadeIn, fadeOut } = useMotionPreset();
  const { name } = param;
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) {
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        onRemove(name);
      }
    },
    [name, onRemove]
  );
  const handleLabel = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onLabel(name, event.target.value),
    [name, onLabel]
  );
  const handleRemove = useCallback(() => onRemove(name), [name, onRemove]);

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      aria-label={`${param.label} input`}
      className="relative flex h-11 items-center gap-3 rounded-[10px] px-2.5 outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
      data-input-row={param.name}
      exit={{ opacity: 0, transition: fadeOut }}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
      layout="position"
      onKeyDown={handleKeyDown}
      role="listitem"
      tabIndex={0}
      transition={{
        layout: spring,
        opacity: { ...fadeIn, delay: staggerDelay(index) },
        y: { ...spring, delay: staggerDelay(index) },
      }}
    >
      <input
        aria-label={`Label for ${param.name}`}
        className="w-36 shrink-0 rounded-[7px] bg-transparent px-1.5 py-1 type-body text-foreground outline-none hover:bg-row-hover focus-visible:bg-row-hover focus-visible:ring-1 focus-visible:ring-primary/60"
        maxLength={40}
        onChange={handleLabel}
        spellCheck={false}
        value={param.label}
      />
      <span className="w-20 shrink-0 type-meta text-panel-muted">
        {PARAM_TYPE_LABELS[param.type]}
      </span>
      <span className="flex min-w-0 flex-1">
        <DefaultEditor
          active={false}
          index={index}
          onChange={onDefault}
          onCommit={onDefault}
          onFocus={skipFocusTracking}
          param={param}
          register={skipRegistration}
          value={param.default}
          valueKey={param.name}
          widgetId=""
        />
      </span>
      <Pressable
        aria-label={`Remove ${param.label}`}
        className="grid size-6 shrink-0 place-items-center rounded-[6px] text-panel-muted hover:bg-row-hover hover:text-foreground"
        onClick={handleRemove}
        tabIndex={-1}
      >
        <XIcon aria-hidden className="size-3.5" />
      </Pressable>
    </motion.div>
  );
}
