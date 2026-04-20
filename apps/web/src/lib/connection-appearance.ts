import type { ConnectionColor, ConnectionEnvironment } from "@/lib/connections";

interface ColorClasses {
  dot: string;
  tint: string;
  ring: string;
  swatch: string;
  border: string;
  label: string;
}

export const CONNECTION_COLORS: readonly ConnectionColor[] = [
  "honey",
  "denim",
  "moss",
  "plum",
  "clay",
  "stone",
] as const;

export const CONNECTION_COLOR_LABELS: Record<ConnectionColor, string> = {
  clay: "Clay",
  denim: "Denim",
  honey: "Honey",
  moss: "Moss",
  plum: "Plum",
  stone: "Stone",
};

const PALETTE: Record<ConnectionColor, ColorClasses> = {
  clay: {
    border: "border-l-[var(--conn-clay)]",
    dot: "bg-[var(--conn-clay)]",
    label: "Clay",
    ring: "ring-[color-mix(in_oklab,var(--conn-clay)_40%,transparent)]",
    swatch: "bg-[var(--conn-clay)]",
    tint: "bg-[color-mix(in_oklab,var(--conn-clay)_14%,transparent)]",
  },
  denim: {
    border: "border-l-[var(--conn-denim)]",
    dot: "bg-[var(--conn-denim)]",
    label: "Denim",
    ring: "ring-[color-mix(in_oklab,var(--conn-denim)_40%,transparent)]",
    swatch: "bg-[var(--conn-denim)]",
    tint: "bg-[color-mix(in_oklab,var(--conn-denim)_14%,transparent)]",
  },
  honey: {
    border: "border-l-[var(--conn-honey)]",
    dot: "bg-[var(--conn-honey)]",
    label: "Honey",
    ring: "ring-[color-mix(in_oklab,var(--conn-honey)_40%,transparent)]",
    swatch: "bg-[var(--conn-honey)]",
    tint: "bg-[color-mix(in_oklab,var(--conn-honey)_14%,transparent)]",
  },
  moss: {
    border: "border-l-[var(--conn-moss)]",
    dot: "bg-[var(--conn-moss)]",
    label: "Moss",
    ring: "ring-[color-mix(in_oklab,var(--conn-moss)_40%,transparent)]",
    swatch: "bg-[var(--conn-moss)]",
    tint: "bg-[color-mix(in_oklab,var(--conn-moss)_14%,transparent)]",
  },
  plum: {
    border: "border-l-[var(--conn-plum)]",
    dot: "bg-[var(--conn-plum)]",
    label: "Plum",
    ring: "ring-[color-mix(in_oklab,var(--conn-plum)_40%,transparent)]",
    swatch: "bg-[var(--conn-plum)]",
    tint: "bg-[color-mix(in_oklab,var(--conn-plum)_14%,transparent)]",
  },
  stone: {
    border: "border-l-[var(--conn-stone)]",
    dot: "bg-[var(--conn-stone)]",
    label: "Stone",
    ring: "ring-[color-mix(in_oklab,var(--conn-stone)_40%,transparent)]",
    swatch: "bg-[var(--conn-stone)]",
    tint: "bg-[color-mix(in_oklab,var(--conn-stone)_14%,transparent)]",
  },
};

export const getConnectionColorClasses = (
  color: ConnectionColor | undefined
): ColorClasses | null => (color ? PALETTE[color] : null);

interface EnvironmentStyle {
  label: string;
  badgeClass: string;
}

const ENVIRONMENT_STYLES: Record<ConnectionEnvironment, EnvironmentStyle> = {
  dev: {
    badgeClass: "border-border bg-muted/50 text-muted-foreground",
    label: "dev",
  },
  prod: {
    badgeClass:
      "border-transparent bg-destructive/90 text-destructive-foreground",
    label: "prod",
  },
  staging: {
    badgeClass: "border-warning/40 bg-warning/15 text-warning",
    label: "staging",
  },
};

export const getEnvironmentStyle = (
  env: ConnectionEnvironment | undefined
): EnvironmentStyle | null => (env ? ENVIRONMENT_STYLES[env] : null);
