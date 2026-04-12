import { Plus, X } from "lucide-react";
import { useCallback } from "react";

import type { QueryTab, TabStatus } from "@/lib/query-types";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const statusDescription: Record<TabStatus, string> = {
  error: "has an error",
  idle: "",
  running: "is running",
  success: "has results",
};

const statusDotClass: Partial<Record<TabStatus, string>> = {
  error: "bg-destructive",
  running: "bg-primary motion-safe:animate-pulse",
  success: "bg-foreground/40",
};

interface QueryTabBarProps {
  tabs: QueryTab[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onAddTab: () => void;
}

interface TabCloseButtonProps {
  tabTitle: string;
  tabId: string;
  onClose: (tabId: string) => void;
}

const TabCloseButton = ({ tabTitle, tabId, onClose }: TabCloseButtonProps) => {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose(tabId);
    },
    [onClose, tabId]
  );

  return (
    <button
      aria-label={`Close ${tabTitle}`}
      className="ml-0.5 rounded-sm p-0.5 text-muted-foreground/70 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none group-hover/tab:text-muted-foreground"
      onClick={handleClick}
      title={`Close ${tabTitle} (⌘W)`}
      type="button"
    >
      <X className="size-3" />
    </button>
  );
};

export const QueryTabBar = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onAddTab,
}: QueryTabBarProps) => {
  const handleValueChange = useCallback(
    (value: unknown) => {
      onSelectTab(value as string);
    },
    [onSelectTab]
  );

  return (
    <Tabs
      value={activeTabId}
      onValueChange={handleValueChange}
      className="gap-0"
    >
      <div className="flex items-center border-b">
        <TabsList variant="segment" className="flex-1">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="group/tab"
              aria-description={statusDescription[tab.status] || undefined}
            >
              {statusDotClass[tab.status] && (
                <span
                  className={`inline-block size-1.5 shrink-0 rounded-full ${statusDotClass[tab.status]}`}
                />
              )}
              <span className="max-w-30 truncate">{tab.title}</span>
              <TabCloseButton
                tabTitle={tab.title}
                tabId={tab.id}
                onClose={onCloseTab}
              />
            </TabsTrigger>
          ))}
        </TabsList>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onAddTab}
                className="mx-1"
                aria-label="New query tab"
              />
            }
          >
            <Plus className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent>New tab</TooltipContent>
        </Tooltip>
      </div>
    </Tabs>
  );
};
