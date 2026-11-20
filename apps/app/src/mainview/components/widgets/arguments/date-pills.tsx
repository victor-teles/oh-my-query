import type { IsoRange } from "@conch/core/client";
import type { ChangeEvent, KeyboardEvent } from "react";

import { DATE_PRESETS, RANGE_PRESETS } from "@conch/core/client";
import { useCallback, useState } from "react";

import type { ParamValue } from "@/lib/ipc";

import {
  DATE_PRESET_LABELS,
  dayAfter,
  dayBefore,
  formatParamValue,
  RANGE_PRESET_LABELS,
} from "@/components/widgets/param-labels";

import type { PillOf } from "./pill-props";

import { PresetPill } from "./preset-pill";

const RANGE_OPTIONS = RANGE_PRESETS.map((value) => ({
  label: RANGE_PRESET_LABELS[value],
  value,
}));

const DATE_OPTIONS = DATE_PRESETS.map((value) => ({
  label: DATE_PRESET_LABELS[value],
  value,
}));

const DATE_INPUT_CLASS =
  "h-7 min-w-0 flex-1 rounded-[6px] bg-row-hover px-1.5 type-meta text-foreground outline-none focus-visible:ring-1 focus-visible:ring-primary/60";

const isoOf = (value: ParamValue | undefined): string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";

interface Range {
  from: string;
  through: string;
}

const rangeOf = (value: ParamValue): Range =>
  typeof value === "object"
    ? { from: value.from, through: dayBefore(value.to) }
    : { from: "", through: "" };

const isEnter = (event: KeyboardEvent<HTMLInputElement>): boolean => {
  if (event.key !== "Enter") {
    return false;
  }
  event.preventDefault();
  event.stopPropagation();
  return true;
};

const rangeFrom = ({ from, through }: Range): IsoRange | null =>
  from && through && from <= through ? { from, to: dayAfter(through) } : null;

export function DateRangePill(props: PillOf<"dateRange">) {
  const { param, value, valueKey, onChange, onCommit } = props;
  const [draft, setDraft] = useState<Range>(() => rangeOf(value));

  const update = useCallback(
    (next: Range) => {
      setDraft(next);
      const range = rangeFrom(next);
      if (range) {
        onChange(valueKey, range);
      }
    },
    [onChange, valueKey]
  );
  const handleFrom = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      update({ ...draft, from: event.target.value }),
    [draft, update]
  );
  const handleThrough = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      update({ ...draft, through: event.target.value }),
    [draft, update]
  );
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      const range = rangeFrom(draft);
      if (isEnter(event) && range) {
        onCommit(valueKey, range);
      }
    },
    [draft, onCommit, valueKey]
  );

  return (
    <PresetPill
      base={props}
      custom={
        <>
          <input
            aria-label={`${param.label} from`}
            className={DATE_INPUT_CLASS}
            onChange={handleFrom}
            onKeyDown={handleKeyDown}
            type="date"
            value={draft.from}
          />
          <span aria-hidden className="type-meta text-panel-muted">
            –
          </span>
          <input
            aria-label={`${param.label} through`}
            className={DATE_INPUT_CLASS}
            onChange={handleThrough}
            onKeyDown={handleKeyDown}
            type="date"
            value={draft.through}
          />
        </>
      }
      display={formatParamValue(param, value)}
      presets={RANGE_OPTIONS}
    />
  );
}

export function DatePill(props: PillOf<"date">) {
  const { param, value, valueKey, onChange, onCommit } = props;
  const [draft, setDraft] = useState(() => isoOf(value));

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setDraft(event.target.value);
      if (event.target.value) {
        onChange(valueKey, event.target.value);
      }
    },
    [onChange, valueKey]
  );
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (isEnter(event) && draft) {
        onCommit(valueKey, draft);
      }
    },
    [draft, onCommit, valueKey]
  );

  return (
    <PresetPill
      base={props}
      custom={
        <input
          aria-label={`${param.label} date`}
          className={DATE_INPUT_CLASS}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          type="date"
          value={draft}
        />
      }
      display={formatParamValue(param, value)}
      presets={DATE_OPTIONS}
    />
  );
}
