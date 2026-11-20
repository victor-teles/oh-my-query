import type { DatabaseType } from "@/lib/connections";
import type { ParamDef } from "@/lib/ipc";

import { databaseTypeLabel } from "@/components/launcher/connections/connection-search";
import { DEFAULT_PORTS } from "@/lib/connections";

interface Counts {
  widgets: number;
  boards: number;
}

export const countLabel = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

const countParts = ({ widgets, boards }: Counts): string[] => [
  ...(widgets > 0 ? [countLabel(widgets, "widget")] : []),
  ...(boards > 0 ? [countLabel(boards, "board")] : []),
];

export const importActionLabel = (counts: Counts): string | null => {
  const parts = countParts(counts);
  return parts.length > 0 ? `Import ${parts.join(", ")}` : null;
};

export const exportedLabel = (counts: Counts): string =>
  `Exported ${countParts(counts).join(", ")}`;

export const importedLabel = (counts: Counts): string => {
  const parts = countParts(counts);
  return parts.length > 0
    ? `Imported ${parts.join(" and ")}.`
    : "Nothing was imported.";
};

const isDatabaseType = (type: string): type is DatabaseType =>
  Object.hasOwn(DEFAULT_PORTS, type);

export const engineLabel = (type: string): string =>
  isDatabaseType(type) ? databaseTypeLabel(type) : type;

export const paramSummary = (params: readonly ParamDef[]): string => {
  const shown = params.filter((param) => !param.fixed);
  return shown.length > 0
    ? `Inputs: ${shown.map((param) => param.label).join(", ")}`
    : "No inputs";
};

const EXPORTED_ON = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export const exportedOnLabel = (iso: string): string | null => {
  const time = Date.parse(iso);
  return Number.isNaN(time)
    ? null
    : `Exported ${EXPORTED_ON.format(new Date(time))}`;
};
