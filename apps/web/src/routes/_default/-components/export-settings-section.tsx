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
import { useExportSettings } from "@/hooks/use-export-settings";
import { CSV_DELIMITERS, NULL_DISPLAY_PRESETS } from "@/lib/export-settings";

const CUSTOM_NULL_SENTINEL = "__custom__";

const CheckboxField = ({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) => (
  <div className="flex items-center gap-2">
    <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
    <Label
      htmlFor={id}
      className="cursor-pointer text-xs text-muted-foreground"
    >
      {label}
    </Label>
  </div>
);

export const ExportSettingsSection = () => {
  const { settings, updateSettings } = useExportSettings();

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
      }
    },
    [updateSettings]
  );

  const handleNullPresetChange = useCallback(
    (v: string | null) => {
      if (v === CUSTOM_NULL_SENTINEL) {
        updateSettings({ nullDisplay: customNullValue });
        return;
      }
      if (v !== null) {
        updateSettings({ nullDisplay: v });
      }
    },
    [updateSettings, customNullValue]
  );

  const handleCustomNullChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setCustomNullValue(val);
      updateSettings({ nullDisplay: val });
    },
    [updateSettings]
  );

  const handleIncludeBomChange = useCallback(
    (checked: boolean) => {
      updateSettings({ includeBom: checked });
    },
    [updateSettings]
  );

  const handleIncludeHeadersChange = useCallback(
    (checked: boolean) => {
      updateSettings({ includeHeaders: checked });
    },
    [updateSettings]
  );

  const nullSelectValue = isCustomNull
    ? CUSTOM_NULL_SENTINEL
    : settings.nullDisplay;

  return (
    <section>
      <h2 className="mb-1 text-sm font-medium">CSV Export</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Configure how query results are exported as CSV files.
      </p>

      <div className="mb-4 flex items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Delimiter</Label>
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
          <Label className="text-xs text-muted-foreground">
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
            <Label className="text-xs text-muted-foreground">Custom text</Label>
            <Input
              value={customNullValue}
              onChange={handleCustomNullChange}
              placeholder="e.g. N/A"
              className="h-7 w-24 text-xs"
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-6">
        <CheckboxField
          id="include-headers"
          label="Include column headers"
          checked={settings.includeHeaders}
          onCheckedChange={handleIncludeHeadersChange}
        />
        <CheckboxField
          id="include-bom"
          label="Include BOM (Excel UTF-8)"
          checked={settings.includeBom}
          onCheckedChange={handleIncludeBomChange}
        />
      </div>
    </section>
  );
};
