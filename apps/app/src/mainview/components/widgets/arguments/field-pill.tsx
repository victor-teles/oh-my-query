import type { ChangeEvent } from "react";

import { useCallback, useState } from "react";

import type { PillOf } from "./pill-props";

import { ArgumentPill } from "./argument-pill";
import { usePillTarget } from "./use-pill-target";

const FIELD_CLASS =
  "min-w-[3ch] max-w-48 bg-transparent type-body text-foreground outline-none focus-visible:outline-none";

const widthOf = (text: string): number => Math.max(text.length, 3);

export function TextPill(props: PillOf<"text">) {
  const { param, value, valueKey, index, active, onChange } = props;
  const target = usePillTarget(props);
  const text = typeof value === "string" ? value : "";
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      onChange(valueKey, event.target.value),
    [onChange, valueKey]
  );
  return (
    <ArgumentPill active={active} index={index} label={param.label}>
      <input
        aria-label={param.label}
        autoComplete="off"
        className={FIELD_CLASS}
        maxLength={200}
        onChange={handleChange}
        onFocus={target.handleFocus}
        ref={target.ref}
        size={widthOf(text)}
        spellCheck={false}
        value={text}
      />
    </ArgumentPill>
  );
}

const NUMBER = /^-?\d*(?:\.\d*)?$/;

export function NumberPill(props: PillOf<"number">) {
  const { param, value, valueKey, index, active, onChange } = props;
  const target = usePillTarget(props);
  const [draft, setDraft] = useState(String(value));
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const next = event.target.value;
      if (!NUMBER.test(next)) {
        return;
      }
      setDraft(next);
      const parsed = Number(next);
      if (next.trim() && Number.isFinite(parsed)) {
        onChange(valueKey, parsed);
      }
    },
    [onChange, valueKey]
  );
  return (
    <ArgumentPill active={active} index={index} label={param.label}>
      <input
        aria-label={param.label}
        autoComplete="off"
        className={`${FIELD_CLASS} tabular-nums`}
        inputMode="decimal"
        onChange={handleChange}
        onFocus={target.handleFocus}
        ref={target.ref}
        size={widthOf(draft)}
        value={draft}
      />
    </ArgumentPill>
  );
}
