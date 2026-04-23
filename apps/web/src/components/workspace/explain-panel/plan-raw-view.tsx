import { Copy } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";

interface PlanRawViewProps {
  raw: string;
}

export const PlanRawView = ({ raw }: PlanRawViewProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Best-effort
    }
  }, [raw]);

  return (
    <div className="relative flex h-full flex-col">
      <Button
        aria-label="Copy raw plan"
        className="absolute top-2 right-2 z-10 h-6 gap-1 px-2 text-[10px]"
        onClick={handleCopy}
        size="sm"
        variant="ghost"
      >
        <Copy aria-hidden="true" className="size-3" />
        {copied ? "Copied" : "Copy"}
      </Button>
      <pre className="flex-1 overflow-auto bg-muted/20 p-3 font-mono text-[11px] leading-relaxed text-foreground/80">
        {raw}
      </pre>
    </div>
  );
};
