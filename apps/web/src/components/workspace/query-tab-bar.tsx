import { AlertCircle, CheckCircle2, Loader2, Plus, X } from "lucide-react";
import { useCallback } from "react";

import type { QueryTab, TabStatus } from "@/lib/query-types";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface QueryTabBarProps {
  tabs: QueryTab[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onAddTab: () => void;
}

const StatusIcon = ({ status }: { status: TabStatus }) => {
  switch (status) {
    case "running": {
      return <Loader2 className="size-3 animate-spin text-muted-foreground" />;
    }
    case "success": {
      return <CheckCircle2 className="size-3 text-emerald-500" />;
    }
    case "error": {
      return <AlertCircle className="size-3 text-destructive" />;
    }
    default: {
      return null;
    }
  }
};

interface TabItemProps {
  tab: QueryTab;
  isActive: boolean;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
}

const TabItem = ({ tab, isActive, onSelect, onClose }: TabItemProps) => {
  const handleSelect = useCallback(() => onSelect(tab.id), [onSelect, tab.id]);
  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose(tab.id);
    },
    [onClose, tab.id]
  );

  return (
    <button
      type="button"
      onClick={handleSelect}
      className={`group flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs transition-colors ${
        isActive
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      <StatusIcon status={tab.status} />
      <span className="max-w-[120px] truncate">{tab.title}</span>
      <button
        type="button"
        onClick={handleClose}
        className="ml-0.5 rounded p-0.5 opacity-0 hover:bg-muted group-hover:opacity-100"
        aria-label={`Close ${tab.title}`}
      >
        <X className="size-3" />
      </button>
    </button>
  );
};

export const QueryTabBar = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onAddTab,
}: QueryTabBarProps) => (
  <div className="flex items-center gap-0.5 border-b bg-muted/30 px-1">
    {tabs.map((tab) => (
      <TabItem
        key={tab.id}
        tab={tab}
        isActive={tab.id === activeTabId}
        onSelect={onSelectTab}
        onClose={onCloseTab}
      />
    ))}
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onAddTab}
            className="ml-1"
            aria-label="New query tab"
          />
        }
      >
        <Plus className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>New tab</TooltipContent>
    </Tooltip>
  </div>
);
