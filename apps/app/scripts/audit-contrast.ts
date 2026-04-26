#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, "..", "src", "index.css");
const OUT_PATH = join(HERE, "..", "docs", "color-tokens.md");

interface Rgb {
  r: number;
  g: number;
  b: number;
}
type Color = Rgb & { a: number };

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function oklchToRgb(l: number, c: number, h: number): Rgb {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);

  const lLms = l + 0.396_337_777_4 * a + 0.215_803_757_3 * b;
  const mLms = l - 0.105_561_345_8 * a - 0.063_854_172_8 * b;
  const sLms = l - 0.089_484_177_5 * a - 1.291_485_548 * b;

  const lCubed = lLms ** 3;
  const mCubed = mLms ** 3;
  const sCubed = sLms ** 3;

  const rLin =
    4.076_741_661_2 * lCubed -
    3.307_711_591_3 * mCubed +
    0.230_969_929 * sCubed;
  const gLin =
    -1.268_438_004_6 * lCubed +
    2.609_757_401_1 * mCubed -
    0.341_319_396_5 * sCubed;
  const bLin =
    -0.004_196_086_3 * lCubed -
    0.703_418_614_7 * mCubed +
    1.707_614_701 * sCubed;

  const toSrgb = (v: number): number => {
    const x = clamp01(v);
    return x <= 0.003_130_8 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  };

  return { b: toSrgb(bLin), g: toSrgb(gLin), r: toSrgb(rLin) };
}

const OKLCH_RE =
  /oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?(?:\s*\/\s*([\d.]+%?))?\s*\)/i;

function parseOklch(value: string): Color | null {
  const match = value.match(OKLCH_RE);
  if (!match) {
    return null;
  }
  const [, lRaw, cRaw, hRaw, aRaw] = match;
  const lStr = lRaw ?? "";
  const cStr = cRaw ?? "0";
  const hStr = hRaw ?? "0";
  const lNum = lStr.endsWith("%")
    ? Number.parseFloat(lStr) / 100
    : Number.parseFloat(lStr);
  const cNum = Number.parseFloat(cStr);
  const hNum = Number.parseFloat(hStr);
  let alpha = 1;
  if (aRaw) {
    alpha = aRaw.endsWith("%")
      ? Number.parseFloat(aRaw) / 100
      : Number.parseFloat(aRaw);
  }
  const rgb = oklchToRgb(lNum, cNum, hNum);
  return { ...rgb, a: alpha };
}

function blockBetween(css: string, start: number, end: number): string {
  return css.slice(start, end);
}

type TokenMap = Map<string, Color>;

function parseTokens(css: string): { light: TokenMap; dark: TokenMap } {
  const light = new Map<string, Color>();
  const dark = new Map<string, Color>();

  const lightStart = css.indexOf(":root,");
  const darkStart = css.indexOf(".dark");
  const themeStart = css.indexOf("@theme");

  const lightCss = blockBetween(css, lightStart, darkStart);
  const darkCss = blockBetween(css, darkStart, themeStart);

  const tokenRe = /--([\w-]+):\s*([^;]+);/g;

  for (const block of [
    { css: lightCss, target: light },
    { css: darkCss, target: dark },
  ]) {
    let match: RegExpExecArray | null;
    match = tokenRe.exec(block.css);
    while (match) {
      const [, name, raw] = match;
      const rawStr = (raw ?? "").trim();
      if (rawStr.startsWith("oklch(")) {
        const color = parseOklch(rawStr);
        if (color && name) {
          block.target.set(name, color);
        }
      }
      match = tokenRe.exec(block.css);
    }
    tokenRe.lastIndex = 0;
  }

  resolveAlias(light, "sidebar-primary", "primary");
  resolveAlias(light, "sidebar-primary-foreground", "primary-foreground");
  resolveAlias(dark, "sidebar-primary", "primary");
  resolveAlias(dark, "sidebar-primary-foreground", "primary-foreground");

  return { dark, light };
}

function resolveAlias(map: TokenMap, name: string, target: string): void {
  if (!map.has(name) && map.has(target)) {
    const value = map.get(target);
    if (value) {
      map.set(name, value);
    }
  }
}

function compositeOver(top: Color, base: Rgb, opacity = 1): Rgb {
  const a = clamp01(top.a * opacity);
  return {
    b: top.b * a + base.b * (1 - a),
    g: top.g * a + base.g * (1 - a),
    r: top.r * a + base.r * (1 - a),
  };
}

function srgbToLinear(v: number): number {
  return v <= 0.039_28 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance({ r, g, b }: Rgb): number {
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

function contrastRatio(fg: Rgb, bg: Rgb): number {
  const lFg = relativeLuminance(fg);
  const lBg = relativeLuminance(bg);
  const [light, dark] = lFg > lBg ? [lFg, lBg] : [lBg, lFg];
  return (light + 0.05) / (dark + 0.05);
}

const VIBRANCY_DARK: Rgb = { b: 0.11, g: 0.105, r: 0.105 };
const VIBRANCY_LIGHT: Rgb = { b: 0.945, g: 0.94, r: 0.94 };

type PairKind = "text" | "large-text" | "ui" | "decorative";

interface PairSpec {
  fg: string;
  bg: string;
  bgOpacity?: number;
  surface: string;
  kind: PairKind;
}

const PAIRS: PairSpec[] = [
  { bg: "background", fg: "foreground", kind: "text", surface: "page" },
  { bg: "card", fg: "card-foreground", kind: "text", surface: "card" },
  { bg: "popover", fg: "popover-foreground", kind: "text", surface: "popover" },
  {
    bg: "primary",
    fg: "primary-foreground",
    kind: "text",
    surface: "primary fill",
  },
  {
    bg: "secondary",
    fg: "secondary-foreground",
    kind: "text",
    surface: "secondary fill",
  },
  { bg: "muted", fg: "muted-foreground", kind: "text", surface: "muted" },
  { bg: "accent", fg: "accent-foreground", kind: "text", surface: "accent" },
  {
    bg: "destructive",
    fg: "destructive-foreground",
    kind: "text",
    surface: "destructive fill",
  },
  {
    bg: "warning",
    fg: "warning-foreground",
    kind: "text",
    surface: "warning fill",
  },
  {
    bg: "success",
    fg: "success-foreground",
    kind: "text",
    surface: "success fill",
  },
  {
    bg: "sidebar",
    fg: "sidebar-foreground",
    kind: "text",
    surface: "sidebar (opaque)",
  },
  {
    bg: "sidebar-accent",
    fg: "sidebar-accent-foreground",
    kind: "text",
    surface: "sidebar accent",
  },
  {
    bg: "sidebar",
    bgOpacity: 0.8,
    fg: "sidebar-foreground",
    kind: "text",
    surface: "sidebar (vibrancy 80%)",
  },
  {
    bg: "sidebar",
    bgOpacity: 0.8,
    fg: "muted-foreground",
    kind: "text",
    surface: "muted text on vibrancy sidebar",
  },
  {
    bg: "background",
    bgOpacity: 0.85,
    fg: "foreground",
    kind: "text",
    surface: "dynamic island (background 85%)",
  },
  {
    bg: "background",
    bgOpacity: 0.85,
    fg: "muted-foreground",
    kind: "text",
    surface: "dynamic island muted",
  },
  {
    bg: "input",
    bgOpacity: 0.3,
    fg: "foreground",
    kind: "text",
    surface: "input field (30% over vibrancy)",
  },
  {
    bg: "background",
    fg: "border",
    kind: "decorative",
    surface: "border on page",
  },
  {
    bg: "sidebar",
    bgOpacity: 0.8,
    fg: "border",
    kind: "decorative",
    surface: "border on vibrancy sidebar",
  },
  {
    bg: "sidebar",
    bgOpacity: 0.8,
    fg: "sidebar-border",
    kind: "decorative",
    surface: "sidebar border on vibrancy",
  },
  {
    bg: "background",
    fg: "ring",
    kind: "ui",
    surface: "focus ring on page",
  },
  {
    bg: "sidebar",
    bgOpacity: 0.8,
    fg: "ring",
    kind: "ui",
    surface: "focus ring on vibrancy sidebar",
  },
  {
    bg: "background",
    bgOpacity: 0.85,
    fg: "ring",
    kind: "ui",
    surface: "focus ring on dynamic island",
  },
  {
    bg: "background",
    fg: "json-key",
    kind: "text",
    surface: "json key on page",
  },
  {
    bg: "background",
    fg: "json-string",
    kind: "text",
    surface: "json string on page",
  },
  {
    bg: "background",
    fg: "json-number",
    kind: "text",
    surface: "json number on page",
  },
  {
    bg: "background",
    fg: "json-boolean",
    kind: "text",
    surface: "json boolean on page",
  },
  {
    bg: "background",
    fg: "conn-honey",
    kind: "ui",
    surface: "connection chip honey",
  },
  {
    bg: "background",
    fg: "conn-denim",
    kind: "ui",
    surface: "connection chip denim",
  },
  {
    bg: "background",
    fg: "conn-moss",
    kind: "ui",
    surface: "connection chip moss",
  },
  {
    bg: "background",
    fg: "conn-plum",
    kind: "ui",
    surface: "connection chip plum",
  },
  {
    bg: "background",
    fg: "conn-clay",
    kind: "ui",
    surface: "connection chip clay",
  },
  {
    bg: "background",
    fg: "conn-stone",
    kind: "ui",
    surface: "connection chip stone",
  },
];

function thresholdFor(kind: PairKind): number {
  if (kind === "ui") {
    return 3;
  }
  if (kind === "large-text") {
    return 3;
  }
  if (kind === "decorative") {
    return 1.4;
  }
  return 4.5;
}

interface Row {
  surface: string;
  fg: string;
  bg: string;
  ratio: number;
  threshold: number;
  pass: boolean;
}

function evaluate(
  tokens: TokenMap,
  vibrancyRef: Rgb,
  pair: PairSpec
): Row | null {
  const fg = tokens.get(pair.fg);
  const bgToken = tokens.get(pair.bg);
  if (!(fg && bgToken)) {
    return null;
  }
  const bgComposited = compositeOver(bgToken, vibrancyRef, pair.bgOpacity ?? 1);
  const fgComposited = compositeOver(fg, bgComposited);
  const ratio = contrastRatio(fgComposited, bgComposited);
  const threshold = thresholdFor(pair.kind);
  return {
    bg: pair.bg,
    fg: pair.fg,
    pass: ratio >= threshold,
    ratio,
    surface: pair.surface,
    threshold,
  };
}

function renderTable(rows: Row[]): string {
  const lines = [
    "| Surface | Foreground | Background | Ratio | Threshold | Status |",
    "|---|---|---|---:|---:|:---:|",
  ];
  for (const row of rows) {
    const status = row.pass ? "PASS" : "FAIL";
    const ratio = row.ratio.toFixed(2);
    const threshold = row.threshold.toFixed(1);
    lines.push(
      `| ${row.surface} | \`--${row.fg}\` | \`--${row.bg}\` | ${ratio} | ${threshold} | ${status} |`
    );
  }
  return lines.join("\n");
}

function dumpTokens(tokens: TokenMap): string {
  const lines = ["| Token | sRGB | Alpha |", "|---|---|---:|"];
  const entries = [...tokens.entries()].toSorted(([a], [b]) =>
    a.localeCompare(b)
  );
  for (const [name, color] of entries) {
    const hex = (n: number): string =>
      Math.round(clamp01(n) * 255)
        .toString(16)
        .padStart(2, "0");
    const swatch = `#${hex(color.r)}${hex(color.g)}${hex(color.b)}`;
    lines.push(`| \`--${name}\` | \`${swatch}\` | ${color.a.toFixed(2)} |`);
  }
  return lines.join("\n");
}

function main(): void {
  const css = readFileSync(CSS_PATH, "utf8");
  const { light, dark } = parseTokens(css);

  const lightRows = PAIRS.map((p) => evaluate(light, VIBRANCY_LIGHT, p)).filter(
    (r): r is Row => r !== null
  );
  const darkRows = PAIRS.map((p) => evaluate(dark, VIBRANCY_DARK, p)).filter(
    (r): r is Row => r !== null
  );

  const lightFails = lightRows.filter((r) => !r.pass);
  const darkFails = darkRows.filter((r) => !r.pass);

  const out = [
    "# Color Token WCAG AA Audit",
    "",
    "Generated by `apps/web/scripts/audit-contrast.ts`. Re-run with",
    "`bun run apps/web/scripts/audit-contrast.ts` after changing any token.",
    "",
    "Vibrancy reference values approximate macOS sidebar vibrancy:",
    "dark `#1a1a1c`, light `#f0f0f1`. Where a background opacity is",
    "noted, the token is composited over the vibrancy reference before",
    "the contrast is measured.",
    "",
    "Thresholds: text 4.5:1, UI / large text 3:1.",
    "",
    "## Light mode",
    "",
    renderTable(lightRows),
    "",
    "## Dark mode",
    "",
    renderTable(darkRows),
    "",
    "## Light tokens (resolved sRGB)",
    "",
    dumpTokens(light),
    "",
    "## Dark tokens (resolved sRGB)",
    "",
    dumpTokens(dark),
    "",
  ].join("\n");

  writeFileSync(OUT_PATH, out);

  const total = lightRows.length + darkRows.length;
  const fails = lightFails.length + darkFails.length;
  console.log(`Audited ${total} pairs. ${fails} failing.`);
  for (const row of lightFails) {
    console.log(
      `  light  FAIL ${row.ratio.toFixed(2)} (need ${row.threshold}) — ${row.surface} (--${row.fg} on --${row.bg})`
    );
  }
  for (const row of darkFails) {
    console.log(
      `  dark   FAIL ${row.ratio.toFixed(2)} (need ${row.threshold}) — ${row.surface} (--${row.fg} on --${row.bg})`
    );
  }
  console.log(`Report written to ${OUT_PATH}`);
  if (fails > 0) {
    process.exit(1);
  }
}

main();
