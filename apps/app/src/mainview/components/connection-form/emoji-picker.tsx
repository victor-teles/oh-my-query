import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { EMOJI_CATALOG } from "./constants";

interface EmojiButtonProps {
  emoji: string;
  isSelected: boolean;
  onSelect: (emoji: string) => void;
}

const EmojiButton = ({ emoji, isSelected, onSelect }: EmojiButtonProps) => {
  const handleClick = useCallback(() => {
    onSelect(emoji);
  }, [emoji, onSelect]);

  return (
    <button
      aria-label={`Select ${emoji}`}
      aria-pressed={isSelected}
      className={cn(`
          flex size-8 items-center justify-center rounded-md text-base
          transition-colors
          hover:bg-muted
        `, isSelected && "bg-accent")}
      onClick={handleClick}
      type="button"
    >
      {emoji}
    </button>
  );
};

interface EmojiPickerProps {
  value: string;
  defaultEmoji: string;
  onSelect: (emoji: string) => void;
}

export const EmojiPicker = ({
  value,
  defaultEmoji,
  onSelect,
}: EmojiPickerProps) => {
  const [open, setOpen] = useState(false);

  const handleSelect = useCallback(
    (emoji: string) => {
      onSelect(emoji);
      setOpen(false);
    },
    [onSelect]
  );

  const handleClear = useCallback(() => {
    onSelect("");
    setOpen(false);
  }, [onSelect]);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <button
            aria-label="Choose emoji"
            className="
              flex size-7 items-center justify-center rounded-md border
              border-input bg-background text-base transition-colors
              hover:border-foreground/40
            "
            type="button"
          >
            {value || <span className="opacity-40">{defaultEmoji}</span>}
          </button>
        }
      />
      <PopoverContent align="start" className="w-auto p-2">
        <div className="grid grid-cols-6 gap-1">
          {EMOJI_CATALOG.map((e) => (
            <EmojiButton
              emoji={e}
              isSelected={value === e}
              key={e}
              onSelect={handleSelect}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-end">
          <Button onClick={handleClear} size="sm" type="button" variant="ghost">
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
