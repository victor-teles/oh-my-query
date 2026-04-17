import type { Components } from "@json-render/react";

import { defineCatalog } from "@json-render/core";
import {
  defineRegistry,
  JSONUIProvider,
  Renderer,
  schema,
} from "@json-render/react";
import { shadcnComponents } from "@json-render/shadcn";
import { shadcnComponentDefinitions } from "@json-render/shadcn/catalog";

import {
  chartComponentDefinitions,
  chartComponents,
} from "@/lib/json-render-charts";

export interface PromptComponentDoc {
  name: string;
  signature: string;
  summary: string;
}

const PRODUCTION_COMPONENTS = [
  {
    name: "Card",
    signature: "{ title?: string, description?: string }",
    summary:
      "Container with optional title/description. Use as top-level wrapper.",
  },
  {
    name: "Stack",
    signature:
      '{ direction?: "horizontal" | "vertical", gap?: number, align?: "start" | "center" | "end", justify?: "start" | "center" | "end" | "between" }',
    summary: "Flex layout container.",
  },
  {
    name: "Grid",
    signature: "{ columns?: number, gap?: number }",
    summary: "Grid layout container.",
  },
  {
    name: "Heading",
    signature: "{ text: string, level?: 1 | 2 | 3 | 4 | 5 | 6 }",
    summary: "Text heading.",
  },
  {
    name: "Text",
    signature:
      '{ text: string, variant?: "default" | "muted" | "destructive" }',
    summary: "Paragraph text.",
  },
  {
    name: "Badge",
    signature:
      '{ text: string, variant?: "default" | "secondary" | "destructive" | "outline" }',
    summary: "Small label/tag.",
  },
  {
    name: "Avatar",
    signature: '{ src?: string, name: string, size?: "sm" | "md" | "lg" }',
    summary: "User avatar with initials fallback.",
  },
  {
    name: "Image",
    signature: "{ src?: string, alt: string, width?: number, height?: number }",
    summary: "Image display.",
  },
  {
    name: "Table",
    signature: "{ columns: string[], rows: string[][], caption?: string }",
    summary: "Data table.",
  },
  {
    name: "Alert",
    signature:
      '{ title: string, message?: string, type?: "default" | "destructive" }',
    summary: "Alert/notice box.",
  },
  {
    name: "Progress",
    signature: "{ value: number, max?: number, label?: string }",
    summary: "Progress bar.",
  },
  {
    name: "Separator",
    signature: '{ orientation?: "horizontal" | "vertical" }',
    summary: "Visual divider.",
  },
  {
    name: "Tabs",
    signature:
      "{ tabs: { label: string, value: string }[], defaultValue?: string }",
    summary: "Tabbed container. Children are rendered in tab panels.",
  },
  {
    name: "Accordion",
    signature: "{ items: { title: string, content: string }[] }",
    summary: "Collapsible sections.",
  },
  {
    name: "Collapsible",
    signature: "{ title: string, defaultOpen?: boolean }",
    summary: "Single collapsible section with children.",
  },
  {
    name: "ChartBar",
    signature:
      '{ data: Array<Record<string, unknown>>, xKey: string, series: { key: string, label?: string, color?: string }[], title?: string, description?: string, layout?: "horizontal" | "vertical", stacked?: boolean }',
    summary:
      "Bar chart for categorical comparisons. `series[i].key` must match a column in each data row.",
  },
  {
    name: "ChartLine",
    signature:
      "{ data: Array<Record<string, unknown>>, xKey: string, series: { key: string, label?: string, color?: string }[], title?: string, description?: string, smooth?: boolean }",
    summary:
      "Line chart for ordered/time-series data. Use smooth for monotone curves.",
  },
  {
    name: "ChartPie",
    signature:
      "{ data: Array<Record<string, unknown>>, nameKey: string, valueKey: string, title?: string, description?: string, donut?: boolean }",
    summary: "Pie/donut chart for part-of-whole. Best with 2–7 slices.",
  },
  {
    name: "ChartKpi",
    signature:
      '{ label: string, value: string | number, description?: string, format?: "number" | "currency" | "percent", delta?: number, deltaLabel?: string, currency?: string }',
    summary:
      "Single-metric summary card for headline numbers and trend deltas.",
  },
] as const satisfies readonly PromptComponentDoc[];

export const promptComponents: readonly PromptComponentDoc[] =
  PRODUCTION_COMPONENTS;

const componentNames = PRODUCTION_COMPONENTS.map((c) => c.name);

export const knownComponentNames: ReadonlySet<string> = new Set(componentNames);

type ProductionName = (typeof PRODUCTION_COMPONENTS)[number]["name"];

const collectFromSources = (
  names: readonly ProductionName[],
  sources: readonly Record<string, unknown>[]
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const name of names) {
    const found = sources.find((s) => name in s);
    if (!found) {
      throw new Error(
        `json-render registry is missing the "${name}" component — the production catalog drifted from the upstream packages.`
      );
    }
    result[name] = found[name];
  }
  return result;
};

type DisplayComponents = Pick<
  typeof shadcnComponentDefinitions & typeof chartComponentDefinitions,
  ProductionName
>;

const displayComponents = collectFromSources(
  componentNames as readonly ProductionName[],
  [shadcnComponentDefinitions, chartComponentDefinitions]
) as DisplayComponents;

export const catalog = defineCatalog(schema, {
  actions: {},
  components: displayComponents,
});

type AppCatalog = typeof catalog;

const renderImplementations = collectFromSources(
  componentNames as readonly ProductionName[],
  [shadcnComponents, chartComponents]
);

const { registry } = defineRegistry(catalog, {
  components: renderImplementations as unknown as Components<AppCatalog>,
});

export { JSONUIProvider, Renderer, registry };
