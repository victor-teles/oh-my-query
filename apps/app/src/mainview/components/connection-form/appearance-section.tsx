import { ChevronDown } from "lucide-react";

import type { ConnectionColor } from "@/lib/connections";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { CONNECTION_COLORS } from "@/lib/connection-appearance";
import { cn } from "@/lib/utils";

import { ColorSwatch } from "./color-swatch";
import { EmojiPicker } from "./emoji-picker";

interface AppearanceSectionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emoji: string;
  color: ConnectionColor | "";
  defaultEmoji: string;
  onEmojiSelect: (emoji: string) => void;
  onColorSelect: (color: ConnectionColor | "") => void;
}

export const AppearanceSection = ({
  open,
  onOpenChange,
  emoji,
  color,
  defaultEmoji,
  onEmojiSelect,
  onColorSelect,
}: AppearanceSectionProps) => (
  <Collapsible onOpenChange={onOpenChange} open={open}>
    <CollapsibleTrigger
      render={
        <button
          className="
            text-section-label flex w-full items-center gap-1.5
            hover:text-foreground
          "
          type="button"
        >
          <ChevronDown
            className={cn("size-3 transition-transform", open && "rotate-180")}
          />
          Appearance
        </button>
      }
    />
    <CollapsibleContent className="grid grid-cols-[auto_1fr] items-start gap-4 pt-3">
      <div className="grid gap-1.5">
        <Label>Emoji</Label>
        <EmojiPicker
          defaultEmoji={defaultEmoji}
          onSelect={onEmojiSelect}
          value={emoji}
        />
      </div>
      <div className="grid gap-1.5">
        <Label>Color</Label>
        <div className="flex h-7 items-center gap-2">
          <ColorSwatch
            color=""
            isSelected={color === ""}
            onSelect={onColorSelect}
          />
          {CONNECTION_COLORS.map((c) => (
            <ColorSwatch
              color={c}
              isSelected={color === c}
              key={c}
              onSelect={onColorSelect}
            />
          ))}
        </div>
      </div>
    </CollapsibleContent>
  </Collapsible>
);
