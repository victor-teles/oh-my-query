import type { Widget } from "@/lib/ipc";

import { fuzzyMatch } from "@/lib/fuzzy-match";

const scoreOf = (widget: Widget, query: string): number | null => {
  const scores = [widget.name, widget.prompt]
    .map((candidate) => fuzzyMatch(candidate, query)?.score ?? null)
    .filter((score): score is number => score !== null);
  return scores.length > 0 ? Math.max(...scores) : null;
};

export const filterWidgets = (
  widgets: readonly Widget[],
  query: string
): Widget[] => {
  const trimmed = query.trim();
  if (!trimmed) {
    return [...widgets];
  }
  return widgets
    .map((widget) => ({ score: scoreOf(widget, trimmed), widget }))
    .filter(
      (entry): entry is { score: number; widget: Widget } =>
        entry.score !== null
    )
    .toSorted((a, b) => b.score - a.score)
    .map((entry) => entry.widget);
};
