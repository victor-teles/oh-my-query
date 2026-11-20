import type { ChangeEvent, KeyboardEvent } from "react";

import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useMotionPreset } from "@/lib/motion";

interface NameFieldProps {
  label: string;
  initial: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export function NameField({
  label,
  initial,
  onConfirm,
  onCancel,
}: NameFieldProps) {
  const [name, setName] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  const { reduced, soft, fadeIn, fadeOut } = useMotionPreset();

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      event.stopPropagation();
      if (event.key === "Enter" && name.trim()) {
        event.preventDefault();
        onConfirm(name.trim());
      } else if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    },
    [name, onCancel, onConfirm]
  );
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setName(event.target.value),
    []
  );

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: fadeOut }}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
      layout
      transition={{ layout: soft, opacity: fadeIn, y: soft }}
    >
      <label className="flex items-center gap-3 px-4 py-2">
        <span className="shrink-0 type-meta text-panel-muted">{label}</span>
        <input
          aria-label={label}
          className="h-8 min-w-0 flex-1 rounded-[8px] bg-row-hover px-2.5 type-body text-foreground outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
          maxLength={60}
          onBlur={onCancel}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          ref={inputRef}
          spellCheck={false}
          value={name}
        />
      </label>
    </motion.div>
  );
}
