import type { CardViewKind } from "@/lib/card-data";

const FILLER = new Set([
  "a",
  "an",
  "as",
  "chart",
  "change",
  "graph",
  "instead",
  "it",
  "make",
  "please",
  "plot",
  "show",
  "switch",
  "the",
  "to",
  "use",
  "view",
]);

const VIEW_WORDS: Record<string, CardViewKind> = {
  area: "area",
  bar: "bar",
  bars: "bar",
  column: "bar",
  columns: "bar",
  donut: "pie",
  kpi: "kpi",
  line: "line",
  lines: "line",
  number: "kpi",
  pie: "pie",
  table: "table",
};

// "as a table", "show as line", "pie chart": short phrases that only change
// how the answer is drawn switch locally instead of asking again.
export const matchViewSwitch = (
  text: string,
  views: readonly CardViewKind[]
): CardViewKind | null => {
  const words = text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => word !== "" && !FILLER.has(word));
  const [word] = words;
  if (words.length !== 1 || !word) {
    return null;
  }
  const view = VIEW_WORDS[word];
  return view && views.includes(view) ? view : null;
};
