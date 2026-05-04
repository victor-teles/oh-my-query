import { Settings2 } from "lucide-react";
import { useCallback } from "react";

import type { DatabaseType } from "@/lib/connections";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useConnection } from "@/contexts/connection-context";
import { supportsSchemaOverride } from "@/lib/connections";

const parsePositiveInt = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

interface RunConfigPopoverProps {
  connectionType: DatabaseType;
}

export const RunConfigPopover = ({ connectionType }: RunConfigPopoverProps) => {
  const { runConfig, setRunConfig } = useConnection();
  const showSchema = supportsSchemaOverride(connectionType);
  const isModified =
    !runConfig.sandbox ||
    runConfig.maxRows !== 100 ||
    runConfig.timeoutSecs !== null ||
    runConfig.schemaOverride !== null;

  const onSandboxChange = useCallback(
    (checked: boolean) => {
      setRunConfig({ sandbox: checked });
    },
    [setRunConfig]
  );

  const onMaxRowsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parsePositiveInt(e.target.value);
      setRunConfig({ maxRows: value ?? 100 });
    },
    [setRunConfig]
  );

  const onTimeoutChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setRunConfig({ timeoutSecs: parsePositiveInt(e.target.value) });
    },
    [setRunConfig]
  );

  const onSchemaChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const trimmed = e.target.value.trim();
      setRunConfig({ schemaOverride: trimmed.length > 0 ? trimmed : null });
    },
    [setRunConfig]
  );

  const onReset = useCallback(() => {
    setRunConfig({
      maxRows: 100,
      sandbox: true,
      schemaOverride: null,
      timeoutSecs: null,
    });
  }, [setRunConfig]);

  const rowCapValue =
    runConfig.maxRows === null ? "" : String(runConfig.maxRows);
  const timeoutValue =
    runConfig.timeoutSecs === null ? "" : String(runConfig.timeoutSecs);

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  aria-label="Run options"
                  className="relative"
                  size="icon-xs"
                  variant="ghost"
                >
                  <Settings2 className="size-3.5" />
                  {isModified && (
                    <span
                      aria-hidden="true"
                      className="
                        absolute top-0.5 right-0.5 size-1.5 rounded-full
                        bg-primary
                      "
                    />
                  )}
                </Button>
              }
            />
          }
        />
        <TooltipContent>Run options</TooltipContent>
      </Tooltip>

      <PopoverContent align="end" className="w-72 space-y-3 p-3">
        <div className="flex items-center justify-between">
          <p className="text-section-label">Run options</p>
          {isModified && (
            <button
              className="
                text-[11px] text-muted-foreground transition-colors
                hover:text-foreground
              "
              onClick={onReset}
              type="button"
            >
              Reset
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-2 font-normal">
            <Checkbox
              checked={runConfig.sandbox}
              onCheckedChange={onSandboxChange}
            />
            Cap rows
          </Label>
          {runConfig.sandbox ? (
            <div className="flex items-center gap-2 pl-6">
              <Input
                aria-label="Row cap"
                className="h-7 w-24"
                inputMode="numeric"
                min={1}
                onChange={onMaxRowsChange}
                placeholder="100"
                type="number"
                value={rowCapValue}
              />
              <span className="text-[11px] text-muted-foreground">rows</span>
            </div>
          ) : (
            <p className="pl-6 text-[11px] text-warning">
              Queries will run uncapped on this connection.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="font-normal" htmlFor="run-config-timeout">
            Statement timeout
          </Label>
          <div className="flex items-center gap-2">
            <Input
              className="h-7 w-24"
              id="run-config-timeout"
              inputMode="numeric"
              min={1}
              onChange={onTimeoutChange}
              placeholder="No limit"
              type="number"
              value={timeoutValue}
            />
            <span className="text-[11px] text-muted-foreground">seconds</span>
          </div>
        </div>

        {showSchema && (
          <div className="space-y-1.5">
            <Label className="font-normal" htmlFor="run-config-schema">
              Default schema
            </Label>
            <Input
              className="h-7"
              id="run-config-schema"
              onChange={onSchemaChange}
              placeholder="Inherit from database"
              value={runConfig.schemaOverride ?? ""}
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
