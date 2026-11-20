import type { ChangeEvent } from "react";

import { AnimatePresence, motion } from "motion/react";
import { useCallback } from "react";

import { Pressable } from "@/components/motion/pressable";
import { useMotionPreset } from "@/lib/motion";

import { SettingsInput } from "./settings-input";

const ACTION_CLASS =
  "h-7 rounded-[8px] px-2.5 type-meta text-foreground hover:bg-row-hover";

interface AiKeyFieldProps {
  // The stored key's mask when it can be kept for the selected provider.
  mask: string | null;
  value: string | null;
  onChange: (apiKey: string | null) => void;
  onClear: () => void;
}

export function AiKeyField({
  mask,
  value,
  onChange,
  onClear,
}: AiKeyFieldProps) {
  const { fadeIn, fadeOut } = useMotionPreset();
  const showMask = mask !== null && value === null;

  const handleReplace = useCallback(() => onChange(""), [onChange]);
  const handleKeep = useCallback(() => onChange(null), [onChange]);
  const handleInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
    [onChange]
  );

  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.div
        animate={{ opacity: 1 }}
        className="flex items-center gap-1"
        exit={{ opacity: 0, transition: fadeOut }}
        initial={{ opacity: 0 }}
        key={showMask ? "mask" : "input"}
        transition={fadeIn}
      >
        {showMask ? (
          <>
            <span
              aria-label="Stored API key"
              className="mr-1.5 font-mono text-[12px] text-panel-muted"
              role="img"
            >
              {mask}
            </span>
            <Pressable className={ACTION_CLASS} onClick={handleReplace}>
              Replace
            </Pressable>
            <Pressable className={ACTION_CLASS} onClick={onClear}>
              Clear
            </Pressable>
          </>
        ) : (
          <>
            <SettingsInput
              aria-label="API key"
              autoFocus={mask !== null}
              onChange={handleInput}
              placeholder="Paste a key"
              type="password"
              value={value ?? ""}
            />
            {mask === null ? null : (
              <Pressable className={ACTION_CLASS} onClick={handleKeep}>
                Keep
              </Pressable>
            )}
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
