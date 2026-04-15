import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { KeysPatternInput } from "./keys-pattern-input";
import { RedisDbChip } from "./redis-db-chip";

interface KeysPanelHeaderProps {
  dbIndex: number;
  totalKeys: number | null;
  onSelectDb: (dbIndex: number) => void;
  onPatternChange: (pattern: string) => void;
  patternFocusKey: number;
  onRefresh: () => void;
  isLoading: boolean;
}

export const KeysPanelHeader = ({
  dbIndex,
  totalKeys,
  onSelectDb,
  onPatternChange,
  patternFocusKey,
  onRefresh,
  isLoading,
}: KeysPanelHeaderProps) => (
  <div className="flex flex-col gap-1.5 border-b border-sidebar-border px-2 py-2">
    <div className="flex items-center gap-1.5">
      <RedisDbChip
        dbIndex={dbIndex}
        onSelect={onSelectDb}
        totalKeys={totalKeys}
      />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label="Refresh keys"
              disabled={isLoading}
              onClick={onRefresh}
              size="icon-xs"
              variant="ghost"
            />
          }
        >
          <RefreshCw className={cn("size-3", isLoading && "animate-spin")} />
        </TooltipTrigger>
        <TooltipContent>Refresh (F5)</TooltipContent>
      </Tooltip>
    </div>
    <KeysPatternInput focusKey={patternFocusKey} onChange={onPatternChange} />
  </div>
);
