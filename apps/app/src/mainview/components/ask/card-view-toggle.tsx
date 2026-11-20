import type { CardViewKind, ViewOption } from "@/lib/card-data";

import { SegmentedControl } from "@/components/ui/segmented-control";

interface CardViewToggleProps {
  options: readonly ViewOption[];
  value: CardViewKind;
  onChange: (view: CardViewKind) => void;
}

export function CardViewToggle({
  options,
  value,
  onChange,
}: CardViewToggleProps) {
  if (options.length < 2) {
    return null;
  }
  return (
    <SegmentedControl
      label="Chart view"
      onChange={onChange}
      options={options.map((option) => ({
        label: option.label,
        value: option.kind,
      }))}
      value={value}
    />
  );
}
