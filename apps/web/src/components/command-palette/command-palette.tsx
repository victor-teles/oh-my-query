import { Command as CommandPrimitive } from "cmdk";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  CommandAction,
  CommandActionGroup,
} from "@/components/command-palette/types";

import { useCommandPalette } from "@/components/command-palette/command-palette-provider";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

const GROUP_ORDER: CommandActionGroup[] = [
  "Suggested",
  "Navigate",
  "Query",
  "Tabs",
  "Connection",
  "Schema",
  "AI",
  "View",
];

const CONFIRM_TIMEOUT_MS = 2500;

const GROUP_CLASS_NAME =
  "**:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:tracking-[0.14em] **:[[cmdk-group-heading]]:text-[0.625rem] **:[[cmdk-group-heading]]:text-muted-foreground/70 **:[[cmdk-group-heading]]:pt-2 **:[[cmdk-group-heading]]:pb-1";

function groupActions(
  actions: CommandAction[]
): Map<CommandActionGroup, CommandAction[]> {
  const grouped = new Map<CommandActionGroup, CommandAction[]>();
  for (const action of actions) {
    const bucket = grouped.get(action.group);
    if (bucket) {
      bucket.push(action);
    } else {
      grouped.set(action.group, [action]);
    }
  }
  return grouped;
}

export const CommandPalette = () => {
  const { open, setOpen, actions, recordUse, recentIds } = useCommandPalette();
  const [search, setSearch] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setConfirmId(null);
    }
  }, [open]);

  useEffect(() => {
    setConfirmId(null);
  }, []);

  useEffect(() => {
    if (!confirmId) {
      return;
    }
    const id = window.setTimeout(() => {
      setConfirmId(null);
    }, CONFIRM_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [confirmId]);

  const handleSearchChange = useCallback((next: string) => {
    setSearch(next);
    setConfirmId(null);
  }, []);

  const visibleActions = useMemo(
    () => actions.filter((action) => (action.when ? action.when() : true)),
    [actions]
  );

  const suggested = useMemo<CommandAction[]>(() => {
    if (recentIds.length === 0) {
      return [];
    }
    const byId = new Map(visibleActions.map((a) => [a.id, a] as const));
    return recentIds
      .map((id) => byId.get(id))
      .filter((a): a is CommandAction => !!a);
  }, [recentIds, visibleActions]);

  const grouped = useMemo(() => groupActions(visibleActions), [visibleActions]);

  const runAction = useCallback(
    (action: CommandAction) => {
      if (action.confirm && confirmId !== action.id) {
        setConfirmId(action.id);
        return;
      }

      setOpen(false);
      setConfirmId(null);
      recordUse(action.id);
      queueMicrotask(async () => {
        try {
          await action.perform();
        } catch (error) {
          toast.error(`${action.label} failed`, {
            description: error instanceof Error ? error.message : undefined,
          });
        }
      });
    },
    [setOpen, recordUse, confirmId]
  );

  return (
    <CommandDialog
      className="max-w-xl!"
      description="Search for a command to run"
      onOpenChange={setOpen}
      open={open}
      title="Command palette"
    >
      <CommandPrimitive
        className="bg-popover text-popover-foreground flex size-full flex-col overflow-hidden rounded-xl p-1"
        label="Command palette"
      >
        <CommandInput
          autoFocus
          onValueChange={handleSearchChange}
          placeholder="Search actions, tables, connections…"
          value={search}
        />
        <CommandList className="max-h-96!">
          <CommandEmpty>
            <div className="flex flex-col items-center gap-1 py-1">
              <span className="text-muted-foreground text-xs">
                No match for &ldquo;{search}&rdquo;
              </span>
              <span className="text-muted-foreground/60 text-[0.6875rem]">
                Try a table, action, or connection name.
              </span>
            </div>
          </CommandEmpty>

          {suggested.length > 0 && (
            <CommandGroup className={GROUP_CLASS_NAME} heading="Suggested">
              {suggested.map((action) => (
                <ActionItem
                  action={action}
                  awaitingConfirm={confirmId === action.id}
                  key={`recent-${action.id}`}
                  onSelect={runAction}
                  value={`recent-${action.id}`}
                />
              ))}
            </CommandGroup>
          )}

          {GROUP_ORDER.filter((g) => g !== "Suggested").map((groupName) => {
            const items = grouped.get(groupName);
            if (!items || items.length === 0) {
              return null;
            }
            return (
              <CommandGroup
                className={GROUP_CLASS_NAME}
                heading={groupName}
                key={groupName}
              >
                {items.map((action) => (
                  <ActionItem
                    action={action}
                    awaitingConfirm={confirmId === action.id}
                    key={action.id}
                    onSelect={runAction}
                    value={action.id}
                  />
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandPrimitive>
    </CommandDialog>
  );
};

interface ActionItemProps {
  action: CommandAction;
  value: string;
  awaitingConfirm: boolean;
  onSelect: (action: CommandAction) => void;
}

interface ActionLeadingIndicatorProps {
  Icon: CommandAction["icon"];
  accentColor: string | undefined;
  destructive: boolean;
}

const ActionLeadingIndicator = ({
  Icon,
  accentColor,
  destructive,
}: ActionLeadingIndicatorProps) => {
  if (accentColor) {
    return (
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: accentColor }}
      />
    );
  }
  if (Icon) {
    return (
      <Icon
        className={cn(
          "text-muted-foreground",
          destructive && "text-destructive/80"
        )}
      />
    );
  }
  return null;
};

interface ActionTrailingIndicatorProps {
  awaitingConfirm: boolean;
  shortcut: string[] | undefined;
}

const ActionTrailingIndicator = ({
  awaitingConfirm,
  shortcut,
}: ActionTrailingIndicatorProps) => {
  if (awaitingConfirm) {
    return (
      <span className="ml-auto whitespace-nowrap text-[0.6875rem] text-destructive">
        Press ↵ again to confirm
      </span>
    );
  }
  if (shortcut && shortcut.length > 0) {
    return (
      <KbdGroup className="ml-auto shrink-0">
        {shortcut.map((key) => (
          <Kbd key={key}>{key}</Kbd>
        ))}
      </KbdGroup>
    );
  }
  return null;
};

const ActionItem = ({
  action,
  value,
  awaitingConfirm,
  onSelect,
}: ActionItemProps) => {
  const Icon = action.icon;
  const keywords = useMemo(
    () => [action.label, action.group, ...(action.keywords ?? [])],
    [action.label, action.group, action.keywords]
  );
  const handleSelect = useCallback(() => {
    onSelect(action);
  }, [action, onSelect]);

  const destructive = action.destructive === true;

  return (
    <CommandItem
      className={cn(
        "min-h-8 gap-2.5 py-1.5 text-[0.8125rem]",
        destructive &&
          "text-destructive data-selected:bg-destructive/10 data-selected:text-destructive data-selected:*:[svg]:text-destructive"
      )}
      keywords={keywords}
      onSelect={handleSelect}
      value={value}
    >
      <ActionLeadingIndicator
        Icon={Icon}
        accentColor={action.accentColor}
        destructive={destructive}
      />
      <span className="min-w-0 flex-1 truncate">{action.label}</span>
      <ActionTrailingIndicator
        awaitingConfirm={awaitingConfirm}
        shortcut={action.shortcut}
      />
    </CommandItem>
  );
};
