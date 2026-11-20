import type { CardResult } from "@conch/rpc";

import monaSansUrl from "@fontsource-variable/mona-sans/files/mona-sans-latin-wght-normal.woff2?url";

import type { CardViewKind } from "@/lib/card-data";
import type { CardSpec } from "@/lib/ipc";

import type { ChartImageLayout, LegendEntry } from "./chart-image-layout";

import { alternatesFor, chartModelOf, pieModelOf } from "./card-data";
import {
  chartImageLayout,
  LEGEND_FONT,
  SUBTITLE_FONT,
  TITLE_FONT,
} from "./chart-image-layout";

const SVG_NS = "http://www.w3.org/2000/svg";
const MIN_SCALE = 2;
const INLINED_PROPERTIES = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-dasharray",
  "opacity",
  "font-family",
  "font-size",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
] as const;
const INTERACTION_LAYERS = ["recharts-tooltip-cursor", "recharts-active-dot"];

export class ChartImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChartImageError";
  }
}

export const chartLegendOf = (
  spec: CardSpec,
  result: CardResult,
  view: CardViewKind
): LegendEntry[] => {
  const options = alternatesFor(spec, result);
  const option = options.find((item) => item.kind === view) ?? options[0];
  switch (option?.view.kind) {
    case "chart": {
      return chartModelOf(option.view, result, spec.formats).data.series;
    }
    case "pie": {
      return pieModelOf(option.view, result, spec.formats).data.series;
    }
    default: {
      return [];
    }
  }
};

const BASE64_CHUNK = 0x80_00;

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let start = 0; start < bytes.length; start += BASE64_CHUNK) {
    binary += String.fromCodePoint(
      ...bytes.subarray(start, start + BASE64_CHUNK)
    );
  }
  return btoa(binary);
};

export const blobToBase64 = async (blob: Blob): Promise<string> =>
  bytesToBase64(new Uint8Array(await blob.arrayBuffer()));

let fontDataUrl: string | null = null;

const loadFontDataUrl = async (): Promise<string> => {
  if (fontDataUrl === null) {
    const response = await fetch(monaSansUrl);
    fontDataUrl = `data:font/woff2;base64,${await blobToBase64(await response.blob())}`;
  }
  return fontDataUrl;
};

const fontFaceRule = (dataUrl: string): string =>
  `@font-face{font-family:"Mona Sans Variable";font-weight:200 900;src:url(${dataUrl}) format("woff2");}`;

const dropEventAttributes = (element: Element) => {
  for (const name of element.getAttributeNames()) {
    if (name.startsWith("on")) {
      element.removeAttribute(name);
    }
  }
};

const inlineComputedStyles = (source: SVGSVGElement, clone: SVGSVGElement) => {
  const sources = [source, ...source.querySelectorAll("*")];
  const clones = [clone, ...clone.querySelectorAll("*")];
  const interactionLayers: Element[] = [];
  for (const [index, element] of sources.entries()) {
    const target = clones[index];
    if (!target) {
      continue;
    }
    if (INTERACTION_LAYERS.some((name) => element.classList.contains(name))) {
      interactionLayers.push(target);
      continue;
    }
    const computed = getComputedStyle(element);
    for (const property of INLINED_PROPERTIES) {
      const value = computed.getPropertyValue(property);
      if (value) {
        target.setAttribute(property, value);
      }
    }
    target.removeAttribute("class");
    dropEventAttributes(target);
  }
  for (const layer of interactionLayers) {
    layer.remove();
  }
};

const serializeChart = async (svg: SVGSVGElement): Promise<string> => {
  const clone = svg.cloneNode(true);
  if (!(clone instanceof SVGSVGElement)) {
    throw new ChartImageError("The chart could not be read.");
  }
  inlineComputedStyles(svg, clone);
  const box = svg.getBoundingClientRect();
  clone.setAttribute("xmlns", SVG_NS);
  clone.setAttribute("width", String(box.width));
  clone.setAttribute("height", String(box.height));
  const style = document.createElementNS(SVG_NS, "style");
  style.textContent = fontFaceRule(await loadFontDataUrl());
  clone.prepend(style);
  return new XMLSerializer().serializeToString(clone);
};

const loadImage = async (markup: string): Promise<HTMLImageElement> => {
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  await image.decode();
  return image;
};

const withColorProbe = <T>(
  read: (resolve: (color: string) => string) => T
): T => {
  const probe = document.createElement("span");
  document.body.append(probe);
  try {
    return read((color) => {
      probe.style.color = color;
      return getComputedStyle(probe).color;
    });
  } finally {
    probe.remove();
  }
};

const toPngBlob = (canvas: HTMLCanvasElement): Promise<Blob> => {
  const { promise, resolve, reject } = Promise.withResolvers<Blob>();
  const failed = new ChartImageError("The chart could not be drawn.");
  try {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(failed)),
      "image/png"
    );
  } catch {
    reject(failed);
  }
  return promise;
};

export interface ChartImageInput {
  svg: SVGSVGElement;
  title: string;
  subtitle?: string;
  legend: readonly LegendEntry[];
  scale?: number;
}

interface Palette {
  base: string;
  foreground: string;
  muted: string;
  surface: string;
  swatches: string[];
}

const paint = (
  context: CanvasRenderingContext2D,
  layout: ChartImageLayout,
  palette: Palette,
  chartImage: HTMLImageElement
) => {
  context.fillStyle = palette.base;
  context.fillRect(0, 0, layout.width, layout.height);
  context.fillStyle = palette.surface;
  context.fillRect(0, 0, layout.width, layout.height);
  context.textBaseline = "middle";
  context.font = TITLE_FONT;
  context.fillStyle = palette.foreground;
  context.fillText(layout.title.text, layout.title.x, layout.title.y);
  if (layout.subtitle) {
    context.font = SUBTITLE_FONT;
    context.fillStyle = palette.muted;
    context.fillText(
      layout.subtitle.text,
      layout.subtitle.x,
      layout.subtitle.y
    );
  }
  context.font = LEGEND_FONT;
  for (const [index, entry] of layout.legend.entries()) {
    const radius = entry.swatch.size / 2;
    context.beginPath();
    context.arc(
      entry.swatch.x + radius,
      entry.baseline,
      radius,
      0,
      Math.PI * 2
    );
    context.fillStyle = palette.swatches[index] ?? palette.muted;
    context.fill();
    context.fillStyle = palette.muted;
    context.fillText(entry.label, entry.labelX, entry.baseline);
  }
  const { chart } = layout;
  context.drawImage(chartImage, chart.x, chart.y, chart.width, chart.height);
};

export const renderChartPng = async ({
  svg,
  title,
  subtitle,
  legend,
  scale = Math.max(MIN_SCALE, window.devicePixelRatio),
}: ChartImageInput): Promise<Blob> => {
  const [markup] = await Promise.all([
    serializeChart(svg),
    document.fonts.load(TITLE_FONT),
    document.fonts.load(LEGEND_FONT),
  ]);
  const chartImage = await loadImage(markup);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new ChartImageError("The chart could not be drawn.");
  }
  const box = svg.getBoundingClientRect();
  const layout = chartImageLayout({
    chart: { height: box.height, width: box.width },
    legend,
    measure: (text, font) => {
      context.font = font;
      return context.measureText(text).width;
    },
    subtitle,
    title,
  });
  const palette = withColorProbe((resolve) => ({
    base: resolve("var(--background)"),
    foreground: resolve("var(--foreground)"),
    muted: resolve("var(--panel-muted)"),
    surface: resolve("var(--panel-solid)"),
    swatches: layout.legend.map((entry) => resolve(entry.color)),
  }));
  canvas.width = Math.round(layout.width * scale);
  canvas.height = Math.round(layout.height * scale);
  context.scale(scale, scale);
  paint(context, layout, palette, chartImage);
  return toPngBlob(canvas);
};
