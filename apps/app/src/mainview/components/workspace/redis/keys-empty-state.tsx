import { Database } from "lucide-react";

import { Button } from "@/components/ui/button";

interface KeysEmptyStateProps {
  variant: "empty-db" | "no-match";
  pattern?: string;
  onRunStarter?: () => void;
}

export const KeysEmptyState = ({
  variant,
  pattern,
  onRunStarter,
}: KeysEmptyStateProps) => {
  if (variant === "empty-db") {
    return (
      <div className="flex flex-col items-start gap-2 px-4 py-6 text-left">
        <Database className="size-5 text-muted-foreground/70" />
        <p className="text-sm font-medium text-foreground">This DB is empty</p>
        <p className="text-xs/relaxed text-muted-foreground">
          Try{" "}
          <code
            className="
              rounded-sm bg-sidebar-accent/60 px-1 font-mono text-[11px]
            "
          >
            SET hello world
          </code>{" "}
          to get started.
        </p>
        {onRunStarter && (
          <Button
            className="mt-1 h-6 px-2 text-[11px]"
            onClick={onRunStarter}
            size="sm"
            variant="outline"
          >
            Run SET hello world
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1.5 px-4 py-6 text-left">
      <p className="text-sm font-medium text-foreground">No keys match</p>
      <p className="text-xs/relaxed text-muted-foreground">
        Nothing matches{" "}
        <code
          className="
          rounded-sm bg-sidebar-accent/60 px-1 font-mono text-[11px]
        "
        >
          {pattern}
        </code>
        . Try a different pattern, or{" "}
        <code
          className="
          rounded-sm bg-sidebar-accent/60 px-1 font-mono text-[11px]
        "
        >
          *
        </code>
        .
      </p>
    </div>
  );
};
