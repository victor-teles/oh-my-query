import type { FooterHint } from "@/components/launcher/launcher-footer";

const STOP: FooterHint = { keys: ["esc"], label: "Stop" };
const BACK: FooterHint = { keys: ["esc"], label: "Back" };
const COPY: FooterHint = { keys: ["⌘", "C"], label: "Copy value" };
const COPIED: FooterHint = { keys: ["⌘", "C"], label: "Copied" };

interface LookupFooterState {
  searching: boolean;
  hasSelection: boolean;
  copied: boolean;
}

export const lookupFooter = ({
  searching,
  hasSelection,
  copied,
}: LookupFooterState) => ({
  actionLabel: hasSelection ? "Open rows" : null,
  hints: [searching ? STOP : BACK, copied ? COPIED : COPY],
});
