import { Check, Copy } from "lucide-react";
import { useCallback, useState } from "react";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

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
          <button
            aria-label={`Show full error. Current error: ${error}`}
            className={`
              text-xs font-medium tracking-tight
              ${maxWidthClass}
              cursor-pointer truncate rounded-sm text-left text-destructive
              transition-opacity duration-150 ease-out
              hover:opacity-80
              focus-visible:ring-2 focus-visible:ring-ring/50
              focus-visible:outline-none
            `}
            title={error}
            type="button"
          />
        }
      >
        {error}
      </HoverCardTrigger>
      <HoverCardContent align="center" className="flex flex-col gap-2">
        <p className="text-sm/relaxed wrap-break-word text-foreground">
          {error}
        </p>
        <button
          aria-label={copied ? "Error copied to clipboard" : "Copy error"}
          className="
            flex items-center gap-1.5 self-end rounded-sm px-2 py-1 text-xs
            text-muted-foreground transition-all duration-150 ease-out
            hover:bg-accent hover:text-accent-foreground
            focus-visible:ring-2 focus-visible:ring-ring/50
            focus-visible:outline-none
          "
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
