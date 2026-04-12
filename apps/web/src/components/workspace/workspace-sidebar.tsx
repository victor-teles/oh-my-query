import { useHotkey } from "@tanstack/react-hotkeys";
import { AlertCircle, Database, RefreshCw, Search } from "lucide-react";
import { useCallback, useState } from "react";

import type { DatabaseConnection } from "@/lib/connections";
import type { SchemaInfo } from "@/lib/tauri";

import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePinnedTables } from "@/hooks/use-pinned-tables";
import { isTauri } from "@/lib/tauri";
import { cn } from "@/lib/utils";

import { QueryHistoryList } from "./query-history-list";
import { SchemaTree } from "./schema-tree";

interface WorkspaceSidebarProps {
  connection: DatabaseConnection;
  schema: SchemaInfo | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  databases: string[] | null;
  selectedDatabase: string | null;
  setSelectedDatabase: (db: string) => void;
}

const SKELETON_ITEMS = [
  { id: "s1", width: "w-3/4" },
  { id: "s2", width: "w-1/2" },
  { id: "s3", width: "w-5/6" },
  { id: "s4", width: "w-2/3" },
  { id: "s5", width: "w-3/5" },
  { id: "s6", width: "w-1/2" },
];

const SchemaLoadingState = () => (
  <div className="space-y-2 px-3 py-2">
    {SKELETON_ITEMS.map((item) => (
      <Skeleton key={item.id} className={cn("h-5", item.width)} />
    ))}
  </div>
);

interface SchemaErrorStateProps {
  error: string;
  onRetry: () => void;
}

const SchemaErrorState = ({ error, onRetry }: SchemaErrorStateProps) => (
  <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
    <AlertCircle className="size-5 text-destructive" />
    <p className="text-xs text-muted-foreground">{error}</p>
    <Button variant="outline" size="sm" onClick={onRetry}>
      <RefreshCw className="mr-1.5 size-3" />
      Retry
    </Button>
  </div>
);

interface DatabaseSelectorProps {
  databases: string[];
  selected: string;
  onSelect: (value: string) => void;
}

const DatabaseSelector = ({
  databases,
  selected,
  onSelect,
}: DatabaseSelectorProps) => {
  const handleChange = useCallback(
    (value: string | null) => {
      if (value) {
        onSelect(value);
      }
    },
    [onSelect]
  );

  return (
    <div className="border-t border-sidebar-border px-2 py-2">
      <Select value={selected} onValueChange={handleChange}>
        <SelectTrigger size="sm" className="w-full">
          <Database className="size-3 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent side="top">
          {databases.map((db) => (
            <SelectItem key={db} value={db}>
              {db}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const FILTER_MIN_ITEMS = 6;

interface SchemaTabContentProps {
  schema: SchemaInfo | null;
  isLoading: boolean;
  error: string | null;
  filter: string;
  onFilterChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRetry: () => void;
  pinnedTables: string[];
  onTogglePin: (tableName: string) => void;
}

const SchemaTabContent = ({
  schema,
  isLoading,
  error,
  filter,
  onFilterChange,
  onRetry,
  pinnedTables,
  onTogglePin,
}: SchemaTabContentProps) => {
  const first = schema?.schemas[0];
  const itemCount = first ? first.tables.length + first.views.length : 0;
  const showFilter = schema !== null && itemCount >= FILTER_MIN_ITEMS;

  return (
    <>
      {showFilter && (
        <div className="px-2 py-2">
          <InputGroup>
            <InputGroupAddon>
              <InputGroupText>
                <Search />
              </InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              onChange={onFilterChange}
              placeholder="Filter tables..."
              value={filter}
            />
          </InputGroup>
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        {isLoading && !schema && <SchemaLoadingState />}
        {error && <SchemaErrorState error={error} onRetry={onRetry} />}
        {schema && (
          <SchemaTree
            filter={filter}
            onTogglePin={onTogglePin}
            pinnedTables={pinnedTables}
            schema={schema}
          />
        )}
      </ScrollArea>
    </>
  );
};

export const WorkspaceSidebar = ({
  connection,
  schema,
  isLoading,
  error,
  refresh,
  databases,
  selectedDatabase,
  setSelectedDatabase,
}: WorkspaceSidebarProps) => {
  const [filter, setFilter] = useState("");
  const { pinnedTables, togglePin } = usePinnedTables(connection.id);

  const handleFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilter(e.target.value);
    },
    []
  );

  useHotkey("F5", () => {
    refresh();
  });

  const showDatabaseSelector =
    databases && databases.length > 1 && selectedDatabase;

  return (
    <div
      className={cn(
        "flex h-full flex-col text-sidebar-foreground",
        isTauri() ? "bg-sidebar/80" : "bg-sidebar"
      )}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <span className="truncate text-sm font-medium">{connection.name}</span>
        {schema && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={refresh}
                  aria-label="Refresh schema"
                  disabled={isLoading}
                />
              }
            >
              <RefreshCw
                className={cn("size-3", isLoading && "animate-spin")}
              />
            </TooltipTrigger>
            <TooltipContent>Refresh schema</TooltipContent>
          </Tooltip>
        )}
      </div>

      <Separator className="bg-sidebar-border" />

      <Tabs defaultValue="schema" className="flex min-h-0 flex-1 flex-col">
        <div className="px-2 pt-2">
          <TabsList className="w-full bg-transparent">
            <TabsTrigger value="schema">Schema</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="schema" className="flex min-h-0 flex-1 flex-col">
          <SchemaTabContent
            schema={schema}
            isLoading={isLoading}
            error={error}
            filter={filter}
            onFilterChange={handleFilterChange}
            onRetry={refresh}
            pinnedTables={pinnedTables}
            onTogglePin={togglePin}
          />
        </TabsContent>

        <TabsContent value="history" className="min-h-0 flex-1">
          <QueryHistoryList connectionId={connection.id} />
        </TabsContent>
      </Tabs>

      {showDatabaseSelector && (
        <DatabaseSelector
          databases={databases}
          selected={selectedDatabase}
          onSelect={setSelectedDatabase}
        />
      )}
    </div>
  );
};
