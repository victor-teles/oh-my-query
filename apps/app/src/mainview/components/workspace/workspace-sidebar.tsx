import { useHotkey } from "@tanstack/react-hotkeys";
import { AlertCircle, Database, RefreshCw, Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import type { DatabaseConnection } from "@/lib/connections";
import type { SchemaInfo } from "@/lib/tauri";

import { SchemaActions } from "@/components/command-palette/actions/schema-actions";
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
import { useEditorInsert } from "@/contexts/editor-insert-context";
import { useFavoriteTables } from "@/hooks/use-favorite-tables";
import { isTauri } from "@/lib/tauri";
import { cn } from "@/lib/utils";

import { QueryHistoryList } from "./query-history-list";
import { KeysPanel } from "./redis/keys-panel";
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
    <div className="border-t border-sidebar-border p-2">
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

interface SchemaTabContentProps {
  schema: SchemaInfo | null;
  isLoading: boolean;
  error: string | null;
  filter: string;
  onFilterChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRetry: () => void;
  favoriteTables: string[];
  onToggleFavorite: (tableName: string) => void;
}

const SchemaTabContent = ({
  schema,
  isLoading,
  error,
  filter,
  onFilterChange,
  onRetry,
  favoriteTables,
  onToggleFavorite,
}: SchemaTabContentProps) => (
  <>
    {schema && (
      <div className="p-2">
        <InputGroup>
          <InputGroupAddon>
            <InputGroupText>
              <Search />
            </InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            onChange={onFilterChange}
            placeholder="Find tables..."
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
          favoriteTables={favoriteTables}
          filter={filter}
          onToggleFavorite={onToggleFavorite}
          schema={schema}
        />
      )}
    </ScrollArea>
  </>
);

const parseDbIndex = (name: string | null): number => {
  if (!name) {
    return 0;
  }
  const match = name.match(/^db(\d+)/);
  return match ? Number.parseInt(match[1] ?? "0", 10) : 0;
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
  const [activeTab, setActiveTab] = useState<"schema" | "history">("schema");
  const { favoriteTables, toggleFavorite } = useFavoriteTables(connection.id);
  const { queryTable } = useEditorInsert();

  const isRedis = connection.type === "redis";
  const dbIndex = useMemo(
    () => (isRedis ? parseDbIndex(selectedDatabase) : 0),
    [isRedis, selectedDatabase]
  );

  const handleFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilter(e.target.value);
    },
    []
  );

  const handleSelectDbIndex = useCallback(
    (idx: number) => {
      setSelectedDatabase(`db${idx}`);
    },
    [setSelectedDatabase]
  );

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value === "history" ? "history" : "schema");
  }, []);

  useHotkey("F5", () => {
    refresh();
  });

  const showDatabaseSelector =
    !isRedis && databases && databases.length > 1 && selectedDatabase;

  const primaryTabLabel = isRedis ? "Keys" : "Schema";

  return (
    <div
      className={cn(
        "flex h-full flex-col text-sidebar-foreground",
        isTauri() ? "bg-sidebar/80" : "bg-sidebar"
      )}
    >
      {!isRedis && (
        <SchemaActions
          onQueryTable={queryTable}
          onRefresh={refresh}
          schema={schema}
        />
      )}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="truncate text-sm font-medium">{connection.name}</span>
        {!isRedis && schema && (
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

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="px-2 pt-2">
          <TabsList className="w-full bg-transparent">
            <TabsTrigger value="schema">{primaryTabLabel}</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="schema" className="flex min-h-0 flex-1 flex-col">
          {isRedis ? (
            <KeysPanel
              connection={connection}
              dbIndex={dbIndex}
              isActiveTab={activeTab === "schema"}
              onSelectDb={handleSelectDbIndex}
            />
          ) : (
            <SchemaTabContent
              error={error}
              favoriteTables={favoriteTables}
              filter={filter}
              isLoading={isLoading}
              onFilterChange={handleFilterChange}
              onRetry={refresh}
              onToggleFavorite={toggleFavorite}
              schema={schema}
            />
          )}
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
