import { Check, Copy } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useState } from "react";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

import { ISLAND_ITEM_TRANSITION, ISLAND_ITEM_VARIANTS } from "./island-motion";

interface IslandErrorMessageProps {
  error: string;
  maxWidthClass: string;
}

const COPY_RESET_MS = 1500;

export const IslandErrorMessage = ({
  error,
  maxWidthClass,
}: IslandErrorMessageProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(error);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_RESET_MS);
    } catch {
      // Clipboard unavailable (older webview, denied permission) — silent noop.
    }
  }, [error]);

  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <motion.button
            aria-label={`Show full error. Current error: ${error}`}
            className={`text-chrome ${maxWidthClass} truncate rounded-sm text-left text-destructive cursor-pointer transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50`}
            title={error}
            transition={ISLAND_ITEM_TRANSITION}
            type="button"
            variants={ISLAND_ITEM_VARIANTS}
          />
        }
      >
        {error}
      </HoverCardTrigger>
      <HoverCardContent align="center" className="flex flex-col gap-2">
        <p className="break-words text-foreground text-sm leading-relaxed">
          {error}
        </p>
        <button
          aria-label={copied ? "Error copied to clipboard" : "Copy error"}
          className="flex items-center gap-1.5 self-end rounded-sm px-2 py-1 text-muted-foreground text-xs transition-all duration-150 ease-out hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          onClick={handleCopy}
          type="button"
        >
          {copied ? (
            <>
              <Check aria-hidden="true" className="size-3" />
              Copied
            </>
          ) : (
            <>
              <Copy aria-hidden="true" className="size-3" />
              Copy
            </>
          )}
        </button>
      </HoverCardContent>
    </HoverCard>
  );
};
