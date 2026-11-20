import { Pressable } from "@/components/motion/pressable";
import { Reveal } from "@/components/motion/reveal";
import { SwapText } from "@/components/motion/swap-text";
import { cn } from "@/lib/utils";

import type { AiFormPhase } from "./ai-settings-reducer";

const SAVE_LABELS: Partial<Record<AiFormPhase["status"], string>> = {
  saved: "Saved",
  saving: "Saving…",
};

const BUTTON =
  "h-7 rounded-[8px] px-3 type-meta disabled:pointer-events-none disabled:opacity-50";

interface AiFormActionsProps {
  phase: AiFormPhase;
  dirty: boolean;
  testing: boolean;
  onTest: () => void;
}

export function AiFormActions({
  phase,
  dirty,
  testing,
  onTest,
}: AiFormActionsProps) {
  const saving = phase.status === "saving";

  return (
    <div className="flex items-center gap-2 px-4 py-3">
      {phase.status === "save-failed" ? (
        <Reveal className="min-w-0 flex-1">
          <span className="type-meta text-danger-ink" role="alert">
            {phase.message}
          </span>
        </Reveal>
      ) : (
        <span className="flex-1" />
      )}
      <Pressable
        className={cn(BUTTON, "text-foreground hover:bg-row-hover")}
        disabled={testing}
        onClick={onTest}
      >
        Test
      </Pressable>
      <Pressable
        className={cn(BUTTON, "bg-primary text-primary-foreground")}
        disabled={saving || !(dirty || phase.status === "saved")}
        type="submit"
      >
        <SwapText value={SAVE_LABELS[phase.status] ?? "Save"} />
      </Pressable>
    </div>
  );
}
