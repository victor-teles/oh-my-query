import { Check } from "lucide-react";
import { useCallback } from "react";

import type { ConnectionColor } from "@/lib/connections";

import { getConnectionColorClasses } from "@/lib/connection-appearance";
import { cn } from "@/lib/utils";

interface ColorSwatchProps {
  color: ConnectionColor | "";
  isSelected: boolean;
  onSelect: (color: ConnectionColor | "") => void;
}

export const ColorSwatch = ({
  color,
  isSelected,
  onSelect,
}: ColorSwatchProps) => {
  const classes = color ? getConnectionColorClasses(color) : null;
  const handleClick = useCallback(() => {
    onSelect(color);
  }, [color, onSelect]);

  if (color === "") {
    return (
      <button aria-label="No color" aria-pressed={isSelected} className={cn(`
            flex size-6 items-center justify-center rounded-full border
            border-dashed border-border text-muted-foreground transition-colors
            hover:border-foreground/40
          `, isSelected && "ring-2 ring-ring ring-offset-2 ring-offset-background")} onClick={handleClick} type="button">
        <span className="sr-only">None</span>
        <span aria-hidden="true" className="text-[10px]">
          ∅
        </span>
      </button>
    );
  }

  if (!classes) {
    return null;
  }

  return (
    <button aria-label={color} aria-pressed={isSelected} className={cn(`
          flex size-6 items-center justify-center rounded-full
          transition-transform
          hover:scale-110
        `, classes.swatch, isSelected && "ring-2 ring-ring ring-offset-2 ring-offset-background")} onClick={handleClick} type="button">
      {isSelected && (
        <Check
          aria-hidden="true"
          className="size-3.5 text-[oklch(0.18_0.005_40)]"
        />
      )}
    </button>
  );
};
