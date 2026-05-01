import { Info } from "lucide-react";
import { useCallback, useState } from "react";

import type { CsvDelimiter } from "@/lib/export-settings";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useExportSettings } from "@/hooks/use-export-settings";
import { CSV_DELIMITERS, NULL_DISPLAY_PRESETS } from "@/lib/export-settings";

import { useSettingsFeedback } from "./settings-feedback-context";

const CUSTOM_NULL_SENTINEL = "__custom__";

interface CheckboxFieldProps {
  id: string;
  label: string;
  checked: boolean;
  hint?: string;
  onCheckedChange: (checked: boolean) => void;
}

const CheckboxField = ({
  id,
  label,
  checked,
  hint,
  onCheckedChange,
}: CheckboxFieldProps) => (
  <div className="flex items-center gap-2">
    <Checkbox checked={checked} id={id} onCheckedChange={onCheckedChange} />
    <Label className="cursor-pointer text-sm text-foreground" htmlFor={id}>
      {label}
    </Label>
    {hint && (
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              aria-label={`What does ${label} mean?`}
              className="
                cursor-pointer text-muted-foreground/60 transition-colors
                hover:text-muted-foreground
                focus:outline-none
                focus-visible:outline-2 focus-visible:outline-offset-2
                focus-visible:outline-sidebar-ring
              "
              type="button"
            />
          }
        >
          <Info className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent>{hint}</TooltipContent>
      </Tooltip>
    )}
  </div>
);

export const ExportSettingsSection = () => {
  const { settings, updateSettings } = useExportSettings();
  const { notifySaved } = useSettingsFeedback();

  const isCustomNull = !NULL_DISPLAY_PRESETS.some(
    (o) => o.value === settings.nullDisplay
  );
  const [customNullValue, setCustomNullValue] = useState(
    isCustomNull ? settings.nullDisplay : ""
  );

  const handleDelimiterChange = useCallback(
    (v: string | null) => {
      if (v) {
        updateSettings({ csvDelimiter: v as CsvDelimiter });
        notifySaved();
      }
    },
    [updateSettings, notifySaved]
  );

  const handleNullPresetChange = useCallback(
    (v: string | null) => {
      if (v === CUSTOM_NULL_SENTINEL) {
        updateSettings({ nullDisplay: customNullValue });
        notifySaved();
        return;
      }
      if (v !== null) {
        updateSettings({ nullDisplay: v });
        notifySaved();
      }
    },
    [updateSettings, customNullValue, notifySaved]
  );

  const handleCustomNullChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setCustomNullValue(val);
      updateSettings({ nullDisplay: val });
      notifySaved();
    },
    [updateSettings, notifySaved]
  );

  const handleIncludeBomChange = useCallback(
    (checked: boolean) => {
      updateSettings({ includeBom: checked });
      notifySaved();
    },
    [updateSettings, notifySaved]
  );

  const handleIncludeHeadersChange = useCallback(
    (checked: boolean) => {
      updateSettings({ includeHeaders: checked });
      notifySaved();
    },
    [updateSettings, notifySaved]
  );

  const nullSelectValue = isCustomNull
    ? CUSTOM_NULL_SENTINEL
    : settings.nullDisplay;

  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">CSV Export</h2>
      <p className="mt-1.5 mb-6 text-sm text-muted-foreground">
        Tune how your results look when you export a CSV.
      </p>

      <div className="mb-6 flex flex-wrap items-end gap-5">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium text-foreground">
            Delimiter
          </Label>
          <Select
            value={settings.csvDelimiter}
            onValueChange={handleDelimiterChange}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start" alignItemWithTrigger={false}>
              {CSV_DELIMITERS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium text-foreground">
            Null value display
          </Label>
          <Select
            value={nullSelectValue}
            onValueChange={handleNullPresetChange}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start" alignItemWithTrigger={false}>
              {NULL_DISPLAY_PRESETS.map((o) => (
                <SelectItem key={`null-${o.label}`} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM_NULL_SENTINEL}>Custom...</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(isCustomNull || nullSelectValue === CUSTOM_NULL_SENTINEL) && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-foreground">
              Custom text
            </Label>
            <Input
              value={customNullValue}
              onChange={handleCustomNullChange}
              placeholder="e.g. N/A"
              className="h-7 w-24 text-xs"
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <CheckboxField
          id="include-headers"
          label="Include column headers"
          checked={settings.includeHeaders}
          onCheckedChange={handleIncludeHeadersChange}
        />
        <CheckboxField
          checked={settings.includeBom}
          hint="Excel on Windows needs this to show non-ASCII characters correctly. Skip if your CSVs go elsewhere."
          id="include-bom"
          label="Include BOM (Excel UTF-8)"
          onCheckedChange={handleIncludeBomChange}
        />
      </div>
    </section>
  );
};
