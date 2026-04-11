import { Kbd, KbdGroup } from "@/components/ui/kbd";

const KeyboardHints = () => (
  <div className="mt-7 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-0.5 text-[11px] text-muted-foreground/70">
    <span className="inline-flex items-center gap-1.5">
      <KbdGroup>
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd>
      </KbdGroup>
      Navigate
    </span>
    <span className="inline-flex items-center gap-1.5">
      <Kbd>↵</Kbd>
      Open
    </span>
    <span className="inline-flex items-center gap-1.5">
      <KbdGroup>
        <Kbd>⌘</Kbd>
        <Kbd>⌫</Kbd>
      </KbdGroup>
      Delete
    </span>
    <span>Right-click for more</span>
  </div>
);

export { KeyboardHints };
