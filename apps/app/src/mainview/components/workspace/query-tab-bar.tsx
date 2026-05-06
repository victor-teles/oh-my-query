import { Plus, X } from "lucide-react";
import { Reorder, useReducedMotion } from "motion/react";
import { useCallback, useMemo } from "react";

import type { QueryTab, TabStatus } from "@/lib/query-types";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isTabDirty } from "@/lib/query-tab-state";

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

const REORDER_SPRING = {
  damping: 38,
  stiffness: 700,
  type: "spring",
} as const;

const DRAG_LIFT = {
  scale: 1.02,
  transition: { damping: 30, stiffness: 600, type: "spring" },
} as const;

interface QueryTabBarProps {
  tabs: QueryTab[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onAddTab: () => void;
  onReorderTabs: (orderedIds: string[]) => void;
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

  // Stop the native pointerdown from reaching motion's drag listener on the
  // parent Reorder.Item — without this, clicking close starts a drag.
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  }, []);

  return (
    <button
      aria-label={`Close ${tabTitle}`}
      className="
        ml-0.5 rounded-sm p-0.5 text-muted-foreground/70
        group-hover/tab:text-muted-foreground
        hover:bg-muted hover:text-foreground
        focus-visible:ring-2 focus-visible:ring-ring/50
        focus-visible:outline-none
      "
      onClick={handleClick}
      onPointerDown={handlePointerDown}
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
  onReorderTabs,
}: QueryTabBarProps) => {
  const reduceMotion = useReducedMotion();
  const tabIds = useMemo(() => tabs.map((t) => t.id), [tabs]);

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
        <div
          className="
            min-w-0 flex-1 overflow-x-auto
            [scrollbar-width:none]
            [&::-webkit-scrollbar]:hidden
          "
        >
          <TabsList
            variant="segment"
            render={
              <Reorder.Group
                as="div"
                axis="x"
                values={tabIds}
                onReorder={onReorderTabs}
              />
            }
          >
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="
                  group/tab max-w-[14rem]
                  min-w-[7rem] !flex-none
                  cursor-grab active:cursor-grabbing
                "
                aria-description={statusDescription[tab.status] || undefined}
                render={
                  <Reorder.Item
                    as="button"
                    value={tab.id}
                    dragElastic={0.08}
                    dragMomentum={false}
                    transition={reduceMotion ? { duration: 0 } : REORDER_SPRING}
                    whileDrag={reduceMotion ? undefined : DRAG_LIFT}
                  />
                }
              >
                {statusDotClass[tab.status] ? (
                  <span className={`
                    inline-block size-1.5 shrink-0 rounded-full
                    ${statusDotClass[tab.status]}
                  `} />
                ) : (
                  isTabDirty(tab) && (
                    <span
                      className="
                      inline-block size-1.5 shrink-0 rounded-full
                      bg-foreground/25
                    "
                    />
                  )
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
        </div>
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
