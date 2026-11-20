import { Kbd, KbdGroup } from "@/components/ui/kbd";

interface KeyComboProps {
  keys: readonly string[];
  className?: string;
}

export function KeyCombo({ keys, className }: KeyComboProps) {
  return (
    <KbdGroup aria-label={keys.join(" ")} className={className}>
      {keys.map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
    </KbdGroup>
  );
}
