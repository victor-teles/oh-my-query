export const IMAGE_FONT_FAMILY =
  '"Mona Sans Variable", -apple-system, sans-serif';
export const TITLE_FONT = `600 15px ${IMAGE_FONT_FAMILY}`;
export const SUBTITLE_FONT = `400 12px ${IMAGE_FONT_FAMILY}`;
export const LEGEND_FONT = `400 12px ${IMAGE_FONT_FAMILY}`;

const PADDING = 24;
const TITLE_LINE = 20;
const SUBTITLE_GAP = 2;
const SUBTITLE_LINE = 16;
const SECTION_GAP = 12;
const LEGEND_LINE = 16;
const LEGEND_ROW_GAP = 4;
const SWATCH = 8;
const SWATCH_GAP = 6;
const ITEM_GAP = 16;
const ELLIPSIS = "…";

export type MeasureText = (text: string, font: string) => number;

export interface LegendEntry {
  label: string;
  color: string;
}

export interface ChartImageLayoutInput {
  chart: { width: number; height: number };
  title: string;
  subtitle?: string;
  legend: readonly LegendEntry[];
  measure: MeasureText;
}

export interface PlacedText {
  text: string;
  x: number;
  y: number;
}

export interface PlacedLegendEntry extends LegendEntry {
  swatch: { x: number; y: number; size: number };
  labelX: number;
  baseline: number;
}

export interface ChartImageLayout {
  width: number;
  height: number;
  title: PlacedText;
  subtitle: PlacedText | null;
  legend: PlacedLegendEntry[];
  chart: { x: number; y: number; width: number; height: number };
}

export const truncateToWidth = (
  text: string,
  maxWidth: number,
  font: string,
  measure: MeasureText
): string => {
  if (measure(text, font) <= maxWidth) {
    return text;
  }
  const characters = [...text];
  while (characters.length > 0) {
    characters.pop();
    const candidate = `${characters.join("").trimEnd()}${ELLIPSIS}`;
    if (measure(candidate, font) <= maxWidth) {
      return candidate;
    }
  }
  return ELLIPSIS;
};

const legendRows = (
  legend: readonly LegendEntry[],
  maxWidth: number,
  measure: MeasureText
): { entry: LegendEntry; label: string; x: number; row: number }[] => {
  const placed: {
    entry: LegendEntry;
    label: string;
    x: number;
    row: number;
  }[] = [];
  let x = 0;
  let row = 0;
  for (const entry of legend) {
    const labelRoom = maxWidth - SWATCH - SWATCH_GAP;
    const label = truncateToWidth(entry.label, labelRoom, LEGEND_FONT, measure);
    const width = SWATCH + SWATCH_GAP + measure(label, LEGEND_FONT);
    if (x > 0 && x + width > maxWidth) {
      x = 0;
      row += 1;
    }
    placed.push({ entry, label, row, x });
    x += width + ITEM_GAP;
  }
  return placed;
};

export const chartImageLayout = ({
  chart,
  title,
  subtitle,
  legend,
  measure,
}: ChartImageLayoutInput): ChartImageLayout => {
  const contentWidth = chart.width;
  let y = PADDING;
  const placedTitle: PlacedText = {
    text: truncateToWidth(title, contentWidth, TITLE_FONT, measure),
    x: PADDING,
    y: y + TITLE_LINE / 2,
  };
  y += TITLE_LINE;

  let placedSubtitle: PlacedText | null = null;
  if (subtitle) {
    y += SUBTITLE_GAP;
    placedSubtitle = {
      text: truncateToWidth(subtitle, contentWidth, SUBTITLE_FONT, measure),
      x: PADDING,
      y: y + SUBTITLE_LINE / 2,
    };
    y += SUBTITLE_LINE;
  }

  const rows = legendRows(legend, contentWidth, measure);
  const legendTop = y + SECTION_GAP;
  const placedLegend = rows.map(({ entry, label, x, row }) => {
    const rowTop = legendTop + row * (LEGEND_LINE + LEGEND_ROW_GAP);
    const baseline = rowTop + LEGEND_LINE / 2;
    return {
      ...entry,
      baseline,
      label,
      labelX: PADDING + x + SWATCH + SWATCH_GAP,
      swatch: { size: SWATCH, x: PADDING + x, y: baseline - SWATCH / 2 },
    };
  });
  const rowCount = rows.length === 0 ? 0 : (rows.at(-1)?.row ?? 0) + 1;
  if (rowCount > 0) {
    y = legendTop + rowCount * LEGEND_LINE + (rowCount - 1) * LEGEND_ROW_GAP;
  }

  const chartTop = y + SECTION_GAP;
  return {
    chart: {
      height: chart.height,
      width: chart.width,
      x: PADDING,
      y: chartTop,
    },
    height: chartTop + chart.height + PADDING,
    legend: placedLegend,
    subtitle: placedSubtitle,
    title: placedTitle,
    width: chart.width + PADDING * 2,
  };
};
