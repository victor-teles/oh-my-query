import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

import type { ModeNote as ModeNoteValue } from "./mode-items";

interface ModeNoteProps {
  note: ModeNoteValue;
}

export function ModeNote({ note }: ModeNoteProps) {
  return (
    <Reveal className="px-5 pt-4 pb-5">
      <p
        className={cn(
          "type-body",
          note.tone === "unsupported" ? "text-panel-muted" : "text-foreground"
        )}
        role="status"
      >
        {note.text}
      </p>
    </Reveal>
  );
}
