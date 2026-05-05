import { Settings2 } from "lucide-react";
import { useCallback } from "react";

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
import { DEFAULT_RUN_CONFIG } from "@/lib/query-types";

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

export const RunConfigPopover = () => {
  const { runConfig, setRunConfig } = useConnection();
  const isModified =
    runConfig.sandbox !== DEFAULT_RUN_CONFIG.sandbox ||
    runConfig.maxRows !== DEFAULT_RUN_CONFIG.maxRows ||
    runConfig.timeoutSecs !== DEFAULT_RUN_CONFIG.timeoutSecs;

  const onSandboxChange = useCallback(
    (checked: boolean) => {
      setRunConfig({ sandbox: checked });
    },
    [setRunConfig]
  );

  const onMaxRowsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parsePositiveInt(e.target.value);
      setRunConfig({ maxRows: value ?? DEFAULT_RUN_CONFIG.maxRows });
    },
    [setRunConfig]
  );

  const onTimeoutChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parsePositiveInt(e.target.value);
      setRunConfig({ timeoutSecs: value ?? DEFAULT_RUN_CONFIG.timeoutSecs });
    },
    [setRunConfig]
  );

  const onReset = useCallback(() => {
    setRunConfig({
      maxRows: DEFAULT_RUN_CONFIG.maxRows,
      sandbox: DEFAULT_RUN_CONFIG.sandbox,
      timeoutSecs: DEFAULT_RUN_CONFIG.timeoutSecs,
    });
  }, [setRunConfig]);

  const rowCapValue =
    runConfig.maxRows === null ? "" : String(runConfig.maxRows);
  const timeoutValue = String(runConfig.timeoutSecs);

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

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label
              className="flex items-center gap-2 font-normal"
              htmlFor="run-config-max-rows"
            >
              <Checkbox
                checked={runConfig.sandbox}
                onCheckedChange={onSandboxChange}
              />
              Cap rows
            </Label>
            <div className="flex items-center gap-1.5">
              <Input
                className="h-7 w-20 text-right"
                disabled={!runConfig.sandbox}
                id="run-config-max-rows"
                inputMode="numeric"
                min={1}
                onChange={onMaxRowsChange}
                placeholder="100"
                type="number"
                value={rowCapValue}
              />
              <span className="w-14 text-[11px] text-muted-foreground">
                rows
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label className="font-normal" htmlFor="run-config-timeout">
              Statement timeout
            </Label>
            <div className="flex items-center gap-1.5">
              <Input
                className="h-7 w-20 text-right"
                id="run-config-timeout"
                inputMode="numeric"
                min={1}
                onChange={onTimeoutChange}
                placeholder="30"
                type="number"
                value={timeoutValue}
              />
              <span className="w-14 text-[11px] text-muted-foreground">
                seconds
              </span>
            </div>
          </div>

          {!runConfig.sandbox && (
            <p className="text-[11px] text-warning">
              Queries will run uncapped on this connection.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
