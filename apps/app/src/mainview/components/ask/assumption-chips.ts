import type { SqlAssumption, SqlAssumptions, TimeGrain } from "@/lib/ipc";

export interface ChipPrefill {
  text: string;
  selection: [start: number, end: number] | null;
}

export interface AssumptionChip {
  key: string;
  label: string;
  prefill: ChipPrefill | null;
  actionLabel: string | null;
}

const ALTERNATE_GRAIN: Record<TimeGrain, TimeGrain> = {
  day: "week",
  hour: "day",
  month: "week",
  quarter: "month",
  week: "month",
  year: "quarter",
};

const selecting = (text: string, word: string): ChipPrefill => {
  const start = text.indexOf(word);
  return { selection: [start, start + word.length], text };
};

const timeChip = (
  item: Extract<SqlAssumption, { kind: "time" }>
): AssumptionChip => {
  if (!item.grain) {
    return {
      actionLabel: `Use another date column than ${item.column}`,
      key: "time",
      label: item.column,
      prefill: selecting(
        `use another date column than ${item.column}`,
        "another date column"
      ),
    };
  }
  const alternate = ALTERNATE_GRAIN[item.grain];
  return {
    actionLabel: `Group by ${alternate} instead of ${item.grain}`,
    key: "time",
    label: `${item.column} · by ${item.grain}`,
    prefill: selecting(
      `group by ${alternate} instead of by ${item.grain}`,
      alternate
    ),
  };
};

const chipOf = (item: SqlAssumption): AssumptionChip | null => {
  switch (item.kind) {
    case "time": {
      return timeChip(item);
    }
    case "filter": {
      return {
        actionLabel: `Refine without ${item.text}`,
        key: `filter:${item.text}`,
        label: item.text,
        prefill: { selection: null, text: `without ${item.text}` },
      };
    }
    case "limit": {
      return {
        actionLabel: "Refine to show all rows",
        key: "limit",
        label: `top ${item.rows}`,
        prefill: {
          selection: null,
          text: `show all rows, not only the top ${item.rows}`,
        },
      };
    }
    default: {
      return null;
    }
  }
};

export const assumptionChips = (
  assumptions: SqlAssumptions | null
): AssumptionChip[] => {
  const items = assumptions?.items ?? [];
  const tables = items.flatMap((item) =>
    item.kind === "table" ? [item.name] : []
  );
  const tableChip: AssumptionChip[] =
    tables.length > 0
      ? [
          {
            actionLabel: null,
            key: "tables",
            label: tables.join(", "),
            prefill: null,
          },
        ]
      : [];
  return [
    ...tableChip,
    ...items
      .map(chipOf)
      .filter((chip): chip is AssumptionChip => chip !== null),
  ];
};
