import { KeyCombo } from "@/components/launcher/key-combo";
import { Reveal } from "@/components/motion/reveal";

export function BoardEmpty() {
  return (
    <Reveal className="flex flex-col items-center gap-3 pt-[18vh] text-center">
      <p className="type-title text-[15px] text-foreground">
        Add widgets from the launcher
      </p>
      <p className="flex flex-wrap items-center justify-center gap-1.5 type-meta text-panel-muted">
        Open a widget with <KeyCombo keys={["⌥", "⇧", "Space"]} />, then
        <KeyCombo keys={["⌘", "K"]} /> → Add to Board
      </p>
    </Reveal>
  );
}
