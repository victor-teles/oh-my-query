import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import type { ConnectionEnvironment } from "@/lib/connections";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { effectivePiiEnabled } from "./lib";

interface AiContextSectionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  piiRedaction: boolean | undefined;
  customPiiPatterns: string;
  environment: ConnectionEnvironment | "";
  onPiiRedactionChange: (checked: boolean) => void;
  onCustomPiiPatternsChange: (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => void;
}

export const AiContextSection = ({
  open,
  onOpenChange,
  piiRedaction,
  customPiiPatterns,
  environment,
  onPiiRedactionChange,
  onCustomPiiPatternsChange,
}: AiContextSectionProps) => {
  const isEnabled = effectivePiiEnabled(piiRedaction, environment);
  const autoEnabled = piiRedaction === undefined && environment === "prod";

  return (
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
              className={cn(
                "size-3 transition-transform",
                open && "rotate-180"
              )}
            />
            AI context
          </button>
        }
      />
      <CollapsibleContent className="grid gap-3 pt-3">
        <div className="grid gap-1.5">
          <Label className="flex items-center gap-2 font-normal">
            <Checkbox
              checked={isEnabled}
              onCheckedChange={onPiiRedactionChange}
            />
            Redact PII from schema context
          </Label>
          <p className="pl-6 text-xs text-muted-foreground">
            Scrubs emails, phone numbers, API keys, and similar patterns from
            schema context before sending to AI providers.
          </p>
          {autoEnabled && (
            <p className="pl-6 text-xs text-warning">
              Enabled automatically for production connections.
            </p>
          )}
        </div>

        <AnimatePresence initial={false}>
          {isEnabled && (
            <motion.div
              animate={{ height: "auto", opacity: 1 }}
              className="grid gap-1.5 overflow-hidden"
              exit={{ height: 0, opacity: 0 }}
              initial={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              <Label htmlFor="conn-pii-patterns">Custom patterns</Label>
              <Textarea
                className="min-h-18 resize-y font-mono text-xs"
                id="conn-pii-patterns"
                onChange={onCustomPiiPatternsChange}
                placeholder={"# one regex per line\ncustomer_id_\\d+"}
                value={customPiiPatterns}
              />
              <p className="text-xs text-muted-foreground">
                Each line is a JavaScript RegExp. No delimiters needed.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </CollapsibleContent>
    </Collapsible>
  );
};
