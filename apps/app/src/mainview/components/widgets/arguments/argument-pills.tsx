import type { FocusEvent, KeyboardEvent } from "react";

import { editableParams } from "@oh-my-query/rpc";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ParamDef, ParamValue, ParamValues, Widget } from "@/lib/ipc";

import type { PillProps } from "./pill-props";

import { DatePill, DateRangePill } from "./date-pills";
import { NumberPill, TextPill } from "./field-pill";
import { SelectPill } from "./select-pill";

export interface ArgumentInput {
  key: string;
  param: ParamDef;
  widgetId: string;
}

export const widgetInputs = (widget: Widget): ArgumentInput[] =>
  editableParams(widget.params).map((param) => ({
    key: param.name,
    param,
    widgetId: widget.id,
  }));

export type PillFocus = "first" | "none";

interface ArgumentPillsProps {
  label: string;
  inputs: readonly ArgumentInput[];
  values: ParamValues;
  initialFocus: PillFocus;
  onChange: (values: ParamValues) => void;
  onSubmit: (values: ParamValues) => void;
  onExit?: () => void;
}

const renderPill = (
  param: ParamDef,
  key: string,
  props: Omit<PillProps, "param">
) => {
  switch (param.type) {
    case "dateRange": {
      return <DateRangePill {...props} key={key} param={param} />;
    }
    case "date": {
      return <DatePill {...props} key={key} param={param} />;
    }
    case "select": {
      return <SelectPill {...props} key={key} param={param} />;
    }
    case "number": {
      return <NumberPill {...props} key={key} param={param} />;
    }
    default: {
      return <TextPill {...props} key={key} param={param} />;
    }
  }
};

export const nextPill = (index: number, step: number, count: number) =>
  (index + step + count) % count;

export function ArgumentPills({
  label,
  inputs,
  values,
  initialFocus,
  onChange,
  onSubmit,
  onExit,
}: ArgumentPillsProps) {
  const [active, setActive] = useState<number | null>(null);
  const targets = useRef<(HTMLElement | null)[]>([]);
  const count = inputs.length;

  const register = useCallback((index: number, element: HTMLElement | null) => {
    targets.current[index] = element;
  }, []);

  useEffect(() => {
    if (initialFocus === "first") {
      targets.current[0]?.focus();
    }
  }, [initialFocus]);

  const change = useCallback(
    (name: string, value: ParamValue) => onChange({ ...values, [name]: value }),
    [onChange, values]
  );
  const commit = useCallback(
    (name: string, value: ParamValue) => {
      const next = { ...values, [name]: value };
      onChange(next);
      onSubmit(next);
    },
    [onChange, onSubmit, values]
  );
  const handleBlur = useCallback((event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setActive(null);
    }
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.defaultPrevented) {
        return;
      }
      if (event.key === "Tab" && count > 0) {
        event.preventDefault();
        const step = event.shiftKey ? -1 : 1;
        targets.current[nextPill(active ?? -1, step, count)]?.focus();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        onSubmit(values);
        return;
      }
      if (event.key === "Escape" && onExit) {
        event.preventDefault();
        onExit();
      }
    },
    [active, count, onExit, onSubmit, values]
  );

  return (
    // Keyboard handling for the pill fields bubbles up to this group.
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      aria-label={label}
      className="flex min-w-0 items-center gap-1.5"
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      role="group"
    >
      {inputs.map((input, index) =>
        renderPill(input.param, input.key, {
          active: active === index,
          index,
          onChange: change,
          onCommit: commit,
          onFocus: setActive,
          register,
          value: values[input.key] ?? input.param.default,
          valueKey: input.key,
          widgetId: input.widgetId,
        })
      )}
    </div>
  );
}
