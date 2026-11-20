import { editableParams, sharedKey } from "@oh-my-query/rpc";

import type { ArgumentInput } from "@/components/widgets/arguments/argument-pills";
import type { Board, ParamValues, Widget } from "@/lib/ipc";

import { currentValues } from "@/components/widgets/param-labels";

export type WidgetsById = ReadonlyMap<string, Widget>;

export interface SharedInput extends ArgumentInput {
  tileIds: string[];
}

export const sharedInputs = (
  board: Board,
  widgets: WidgetsById
): SharedInput[] => {
  const inputs = new Map<string, SharedInput>();
  for (const tile of board.tiles) {
    const widget = widgets.get(tile.widgetId);
    for (const param of widget ? editableParams(widget.params) : []) {
      const key = sharedKey(param);
      const existing = inputs.get(key);
      if (existing) {
        existing.tileIds.push(tile.id);
      } else if (widget) {
        inputs.set(key, {
          key,
          param,
          tileIds: [tile.id],
          widgetId: widget.id,
        });
      }
    }
  }
  return [...inputs.values()];
};

export const tileValues = (
  widget: Widget,
  sharedValues: ParamValues
): ParamValues => {
  const values = currentValues(widget);
  for (const param of editableParams(widget.params)) {
    const shared = sharedValues[sharedKey(param)];
    if (shared !== undefined) {
      values[param.name] = shared;
    }
  }
  return values;
};

export const filterValues = (
  inputs: readonly SharedInput[],
  sharedValues: ParamValues,
  widgets: WidgetsById
): ParamValues =>
  Object.fromEntries(
    inputs.map((input) => {
      const widget = widgets.get(input.widgetId);
      const own = widget ? currentValues(widget)[input.param.name] : undefined;
      return [input.key, sharedValues[input.key] ?? own ?? input.param.default];
    })
  );

export const changedKeys = (
  before: ParamValues,
  after: ParamValues
): string[] =>
  Object.keys(after).filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key])
  );

export const tilesAffectedBy = (
  inputs: readonly SharedInput[],
  keys: readonly string[]
): string[] => [
  ...new Set(
    inputs
      .filter((input) => keys.includes(input.key))
      .flatMap((input) => input.tileIds)
  ),
];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const updatedLabel = (updatedAt: number | null, now: number): string => {
  if (updatedAt === null) {
    return "Not updated yet";
  }
  const elapsed = Math.max(0, now - updatedAt);
  if (elapsed < MINUTE) {
    return "Updated just now";
  }
  if (elapsed < HOUR) {
    return `Updated ${Math.floor(elapsed / MINUTE)}m ago`;
  }
  return `Updated ${Math.floor(elapsed / HOUR)}h ago`;
};
