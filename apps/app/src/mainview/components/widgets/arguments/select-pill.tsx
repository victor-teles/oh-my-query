import type { ChangeEvent, KeyboardEvent } from "react";

import { AnimatePresence } from "motion/react";
import { useCallback, useMemo, useState } from "react";

import type { PillOf } from "./pill-props";

import { ArgumentPill } from "./argument-pill";
import { PillPopover } from "./pill-popover";
import { SelectOptions } from "./select-options";
import { useParamOptions } from "./use-param-options";
import { usePillTarget } from "./use-pill-target";

const MAX_VISIBLE = 6;

export const filterOptions = (
  options: readonly string[],
  text: string,
  current: string
): string[] => {
  const needle = text.trim().toLowerCase();
  if (!needle || text === current) {
    return options.slice(0, MAX_VISIBLE * 4);
  }
  return options.filter((option) => option.toLowerCase().includes(needle));
};

const STEPS: Partial<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };

export function SelectPill(props: PillOf<"select">) {
  const { widgetId, param, value, valueKey, index, active, onCommit } = props;
  const target = usePillTarget(props);
  const current = typeof value === "string" ? value : "";
  const [text, setText] = useState(current);
  const [open, setOpen] = useState(false);
  const [moved, setMoved] = useState<number | null>(null);
  const { ensureLoaded, state } = useParamOptions(widgetId, param);
  const matches = filterOptions(state.options, text, current).slice(
    0,
    MAX_VISIBLE
  );
  const listId = `arg-options-${param.name}`;
  const highlight = moved ?? Math.max(0, matches.indexOf(current));
  const selection = useMemo(
    () => ({ current, highlight }),
    [current, highlight]
  );

  const choose = useCallback(
    (option: string) => {
      setText(option);
      setOpen(false);
      onCommit(valueKey, option);
    },
    [onCommit, valueKey]
  );
  const close = useCallback(() => {
    setOpen(false);
    setText(current);
  }, [current]);

  const { handleFocus: markActive } = target;
  const handleFocus = useCallback(() => {
    markActive();
    setOpen(true);
    setMoved(null);
    ensureLoaded();
  }, [ensureLoaded, markActive]);
  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setText(event.target.value);
    setMoved(0);
    setOpen(true);
  }, []);
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      const step = STEPS[event.key];
      if (step !== undefined) {
        event.preventDefault();
        setOpen(true);
        const count = Math.max(matches.length, 1);
        setMoved((highlight + step + count) % count);
        return;
      }
      if (event.key === "Enter" && open && text !== current) {
        event.preventDefault();
        event.stopPropagation();
        const option = matches[highlight];
        if (option) {
          choose(option);
        }
        return;
      }
      if (event.key === "Escape" && open) {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    },
    [choose, close, current, highlight, matches, open, text]
  );

  const popover = (
    <AnimatePresence>
      {open ? (
        <PillPopover>
          <SelectOptions
            id={listId}
            label={param.label}
            matches={matches}
            onChoose={choose}
            onHighlight={setMoved}
            selection={selection}
            state={state}
          />
        </PillPopover>
      ) : null}
    </AnimatePresence>
  );

  return (
    <ArgumentPill
      active={active}
      index={index}
      label={param.label}
      popover={popover}
    >
      <input
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        aria-label={param.label}
        autoComplete="off"
        className="max-w-48 min-w-[3ch] bg-transparent type-body text-foreground outline-none focus-visible:outline-none"
        onBlur={close}
        onChange={handleChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        ref={target.ref}
        role="combobox"
        size={Math.max(text.length, 3)}
        spellCheck={false}
        value={text}
      />
    </ArgumentPill>
  );
}
