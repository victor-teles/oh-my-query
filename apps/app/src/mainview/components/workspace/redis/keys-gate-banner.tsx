import { Info } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";

interface KeysGateBannerProps {
  totalKeys: number;
  onScanAll: () => void;
}

export const KeysGateBanner = ({
  totalKeys,
  onScanAll,
}: KeysGateBannerProps) => {
  const [confirming, setConfirming] = useState(false);

  const handleScanAll = useCallback(() => {
    if (confirming) {
      onScanAll();
      return;
    }
    setConfirming(true);
  }, [confirming, onScanAll]);

  const handleCancel = useCallback(() => {
    setConfirming(false);
  }, []);

  return (
    <div className="flex flex-col items-start gap-2 px-4 py-6 text-left">
      <Info className="size-5 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">Large keyspace</p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        This DB has {totalKeys.toLocaleString()} keys. Type a pattern above
        (e.g.{" "}
        <code className="rounded bg-sidebar-accent/60 px-1 font-mono text-[11px]">
          user:*
        </code>
        ) to narrow the scan.
      </p>
      <div className="mt-1 flex items-center gap-1">
        <Button
          className="h-6 px-2 text-[11px]"
          onClick={handleScanAll}
          size="sm"
          variant={confirming ? "destructive" : "ghost"}
        >
          {confirming
            ? `Scan ${totalKeys.toLocaleString()} keys anyway`
            : "Scan all anyway"}
        </Button>
        {confirming && (
          <Button
            className="h-6 px-2 text-[11px]"
            onClick={handleCancel}
            size="sm"
            variant="ghost"
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
};
