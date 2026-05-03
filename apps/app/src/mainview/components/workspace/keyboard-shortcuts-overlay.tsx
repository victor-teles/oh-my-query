import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

interface KeyboardShortcutsOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutEntry {
  label: string;
  keys: string[];
}

interface ShortcutSection {
  heading: string;
  entries: ShortcutEntry[];
}

const SECTIONS: ShortcutSection[] = [
  {
    entries: [
      { keys: ["⌘", "↵"], label: "Run query (or selection)" },
      { keys: ["⇧", "⌘", "F"], label: "Format SQL" },
    ],
    heading: "Query",
  },
  {
    entries: [
      { keys: ["⌘", "T"], label: "New tab" },
      { keys: ["⌘", "W"], label: "Close tab" },
      { keys: ["⇧", "⌘", "T"], label: "Reopen closed tab" },
      { keys: ["⌘", "1…9"], label: "Switch to tab" },
    ],
    heading: "Tabs",
  },
  {
    entries: [
      { keys: ["⌘", "B"], label: "Toggle schema sidebar" },
      { keys: ["⇧", "⌘", "C"], label: "Toggle AI chat" },
      { keys: ["⇧", "⌘", "1"], label: "Editor mode" },
      { keys: ["⇧", "⌘", "2"], label: "Split mode" },
      { keys: ["⇧", "⌘", "3"], label: "Chat mode" },
    ],
    heading: "Layout",
  },
  {
    entries: [{ keys: ["F5"], label: "Refresh schema" }],
    heading: "Schema",
  },
  {
    entries: [{ keys: ["⌘", "/"], label: "Show keyboard shortcuts" }],
    heading: "Help",
  },
];

const Shortcut = ({ label, keys }: ShortcutEntry) => (
  <div className="flex items-center justify-between gap-4 py-1">
    <span className="text-xs text-foreground">{label}</span>
    <KbdGroup>
      {keys.map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
    </KbdGroup>
  </div>
);

export const KeyboardShortcutsOverlay = ({
  open,
  onOpenChange,
}: KeyboardShortcutsOverlayProps) => (
  <Dialog onOpenChange={onOpenChange} open={open}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Keyboard shortcuts</DialogTitle>
        <DialogDescription>
          The moves that live in your fingers, not your mouse.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-5">
        {SECTIONS.map((section) => (
          <section key={section.heading}>
            <h3 className="text-section-label mb-1">{section.heading}</h3>
            <div>
              {section.entries.map((entry) => (
                <Shortcut
                  key={entry.label}
                  keys={entry.keys}
                  label={entry.label}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </DialogContent>
  </Dialog>
);
