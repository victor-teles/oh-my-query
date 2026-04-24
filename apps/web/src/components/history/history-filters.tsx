import { ChevronDownIcon, FilterXIcon, XIcon } from "lucide-react";
import { memo, useCallback, useMemo } from "react";

import type { DatabaseConnection, DatabaseType } from "@/lib/connections";
import type { HistoryFilters } from "@/lib/persistence";

import { DATABASE_ICON_MAP } from "@/components/icons/database-icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { KNOWN_DIALECTS } from "@/lib/history-shared";
import { cn } from "@/lib/utils";

const DIALECT_LABELS: Record<DatabaseType, string> = {
  clickhouse: "ClickHouse",
  duckdb: "DuckDB",
  mongodb: "MongoDB",
  mssql: "SQL Server",
  mysql: "MySQL",
  postgresql: "PostgreSQL",
  redis: "Redis",
  sqlite: "SQLite",
};

const ERRORED_ONLY_ID = "history-filter-errored-only";

interface HistoryFiltersPanelProps {
  filters: HistoryFilters;
  setFilters: (updater: (prev: HistoryFilters) => HistoryFilters) => void;
  connections: DatabaseConnection[];
  onReset: () => void;
}

const toggleInArray = <T,>(arr: T[] | undefined, value: T): T[] => {
  const current = arr ?? [];
  return current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];
};

const formatSelection = (names: string[], max = 2): string => {
  if (names.length === 0) {
    return "";
  }
  if (names.length <= max) {
    return names.join(", ");
  }
  const shown = names.slice(0, max).join(", ");
  const rest = names.length - max;
  return `${shown} +${rest}`;
};

interface FilterTriggerProps {
  icon?: React.ReactNode;
  label: string;
  placeholder: string;
  selection: string[];
  onClear?: () => void;
}

const FilterTrigger = ({
  icon,
  label,
  placeholder,
  selection,
  onClear,
}: FilterTriggerProps) => {
  const active = selection.length > 0;

  const handleClear = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      onClear?.();
    },
    [onClear]
  );

  return (
    <div
      className={cn(
        "group/trigger flex h-7 min-w-0 items-center gap-1.5 rounded-md border px-2 text-xs",
        "transition-[color,background-color,border-color] duration-150 ease-out",
        active
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-input bg-input/20 text-muted-foreground hover:bg-input/40 hover:text-foreground"
      )}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span className="shrink-0 text-muted-foreground/80">{label}</span>
      <span
        className={cn(
          "min-w-0 truncate",
          active ? "text-foreground" : "text-muted-foreground/60"
        )}
      >
        {active ? formatSelection(selection) : placeholder}
      </span>
      {active && onClear ? (
        <button
          aria-label={`Clear ${label.toLowerCase()} filter`}
          className="ml-0.5 shrink-0 rounded-sm p-0.5 text-muted-foreground/80 hover:bg-background/50 hover:text-foreground"
          onClick={handleClear}
          type="button"
        >
          <XIcon className="size-3" />
        </button>
      ) : (
        <ChevronDownIcon className="ml-0.5 size-3 shrink-0 text-muted-foreground/60" />
      )}
    </div>
  );
};

interface ConnectionOptionProps {
  connection: DatabaseConnection;
  checked: boolean;
  onToggle: (id: string) => void;
}

const ConnectionOption = memo(function ConnectionOption({
  connection,
  checked,
  onToggle,
}: ConnectionOptionProps) {
  const Icon = DATABASE_ICON_MAP[connection.type];
  const handleClick = useCallback(() => {
    onToggle(connection.id);
  }, [connection.id, onToggle]);
  return (
    <button
      aria-pressed={checked}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs",
        "hover:bg-accent/50",
        checked && "text-foreground"
      )}
      onClick={handleClick}
      type="button"
    >
      <Checkbox checked={checked} tabIndex={-1} />
      <Icon className="size-3.5 text-muted-foreground" />
      <span className="truncate">{connection.name}</span>
    </button>
  );
});

interface DialectOptionProps {
  dialect: DatabaseType;
  checked: boolean;
  onToggle: (dialect: DatabaseType) => void;
}

const DialectOption = memo(function DialectOption({
  dialect,
  checked,
  onToggle,
}: DialectOptionProps) {
  const Icon = DATABASE_ICON_MAP[dialect];
  const handleClick = useCallback(() => {
    onToggle(dialect);
  }, [dialect, onToggle]);
  return (
    <button
      aria-pressed={checked}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs",
        "hover:bg-accent/50",
        checked && "text-foreground"
      )}
      onClick={handleClick}
      type="button"
    >
      <Checkbox checked={checked} tabIndex={-1} />
      <Icon className="size-3.5 text-muted-foreground" />
      <span>{DIALECT_LABELS[dialect]}</span>
    </button>
  );
});

export const HistoryFiltersPanel = ({
  filters,
  setFilters,
  connections,
  onReset,
}: HistoryFiltersPanelProps) => {
  const selectedConnections = filters.connectionIds ?? [];
  const selectedDialects = filters.dialects ?? [];

  const connectionNameById = useMemo(
    () => new Map(connections.map((c) => [c.id, c.name])),
    [connections]
  );
  const selectedConnectionNames = selectedConnections.map(
    (id) => connectionNameById.get(id) ?? "Deleted"
  );
  const selectedDialectLabels = selectedDialects.map(
    (d) => DIALECT_LABELS[d as DatabaseType] ?? d
  );

  const toggleConnection = useCallback(
    (id: string) => {
      setFilters((prev) => ({
        ...prev,
        connectionIds: toggleInArray(prev.connectionIds, id),
      }));
    },
    [setFilters]
  );

  const toggleDialect = useCallback(
    (dialect: DatabaseType) => {
      setFilters((prev) => ({
        ...prev,
        dialects: toggleInArray(prev.dialects, dialect),
      }));
    },
    [setFilters]
  );

  const clearConnections = useCallback(() => {
    setFilters((prev) => ({ ...prev, connectionIds: undefined }));
  }, [setFilters]);

  const clearDialects = useCallback(() => {
    setFilters((prev) => ({ ...prev, dialects: undefined }));
  }, [setFilters]);

  const handleMinRuntimeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setFilters((prev) => ({
        ...prev,
        minRuntimeMs: raw === "" ? undefined : Number(raw),
      }));
    },
    [setFilters]
  );

  const handleMaxRuntimeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setFilters((prev) => ({
        ...prev,
        maxRuntimeMs: raw === "" ? undefined : Number(raw),
      }));
    },
    [setFilters]
  );

  const toggleErroredOnly = useCallback(
    (checked: boolean) => {
      setFilters((prev) => ({
        ...prev,
        erroredOnly: checked ? true : undefined,
      }));
    },
    [setFilters]
  );

  const hasAnyFilter =
    selectedConnections.length > 0 ||
    selectedDialects.length > 0 ||
    filters.minRuntimeMs !== undefined ||
    filters.maxRuntimeMs !== undefined ||
    filters.erroredOnly === true;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover>
        <PopoverTrigger
          render={
            <button
              aria-label="Filter by connection"
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              type="button"
            >
              <FilterTrigger
                label="Connection"
                onClear={
                  selectedConnections.length > 0 ? clearConnections : undefined
                }
                placeholder="Any"
                selection={selectedConnectionNames}
              />
            </button>
          }
        />
        <PopoverContent align="start" className="w-64 p-1">
          {connections.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              No saved connections.
            </p>
          ) : (
            <div className="max-h-64 overflow-auto">
              {connections.map((c) => (
                <ConnectionOption
                  checked={selectedConnections.includes(c.id)}
                  connection={c}
                  key={c.id}
                  onToggle={toggleConnection}
                />
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger
          render={
            <button
              aria-label="Filter by dialect"
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              type="button"
            >
              <FilterTrigger
                label="Dialect"
                onClear={
                  selectedDialects.length > 0 ? clearDialects : undefined
                }
                placeholder="Any"
                selection={selectedDialectLabels}
              />
            </button>
          }
        />
        <PopoverContent align="start" className="w-56 p-1">
          <div className="max-h-64 overflow-auto">
            {KNOWN_DIALECTS.map((d) => (
              <DialectOption
                checked={selectedDialects.includes(d)}
                dialect={d}
                key={d}
                onToggle={toggleDialect}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <div className="flex items-center gap-1">
        <Label
          className="text-[10px] text-muted-foreground"
          htmlFor="runtime-min"
        >
          Runtime
        </Label>
        <Input
          aria-label="Minimum runtime in milliseconds"
          className="h-7 w-16 text-xs"
          id="runtime-min"
          inputMode="numeric"
          min={0}
          onChange={handleMinRuntimeChange}
          placeholder="min"
          type="number"
          value={filters.minRuntimeMs ?? ""}
        />
        <span className="text-xs text-muted-foreground">–</span>
        <Input
          aria-label="Maximum runtime in milliseconds"
          className="h-7 w-16 text-xs"
          inputMode="numeric"
          min={0}
          onChange={handleMaxRuntimeChange}
          placeholder="max"
          type="number"
          value={filters.maxRuntimeMs ?? ""}
        />
        <span className="text-[10px] text-muted-foreground">ms</span>
      </div>

      <Label
        className={cn(
          "flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-xs",
          "transition-[color,background-color,border-color] duration-150 ease-out",
          filters.erroredOnly === true
            ? "border-primary/40 bg-primary/10 text-foreground"
            : "border-input bg-input/20 text-muted-foreground hover:bg-input/40 hover:text-foreground"
        )}
        htmlFor={ERRORED_ONLY_ID}
      >
        <Checkbox
          checked={filters.erroredOnly === true}
          id={ERRORED_ONLY_ID}
          onCheckedChange={toggleErroredOnly}
        />
        Errored only
      </Label>

      {hasAnyFilter && (
        <Button
          className="ml-auto h-7"
          onClick={onReset}
          size="sm"
          variant="ghost"
        >
          <FilterXIcon className="size-3" />
          Reset
        </Button>
      )}
    </div>
  );
};
