import { describe, expect, it } from "vitest";

import type { ConnectionColor, ConnectionEnvironment } from "@/lib/connections";

import {
  CONNECTION_COLOR_LABELS,
  CONNECTION_COLORS,
  getConnectionColorClasses,
  getEnvironmentStyle,
} from "@/lib/connection-appearance";

describe("connection color palette", () => {
  it("exposes a stable ordered list of colors", () => {
    expect(CONNECTION_COLORS).toStrictEqual([
      "honey",
      "denim",
      "moss",
      "plum",
      "clay",
      "stone",
    ]);
  });

  it("provides a label for every palette entry", () => {
    for (const color of CONNECTION_COLORS) {
      expect(CONNECTION_COLOR_LABELS[color]).toBeTruthy();
    }
  });

  it("returns class tokens that reference the matching CSS variable", () => {
    const honey = getConnectionColorClasses("honey");
    expect(honey).not.toBeNull();
    expect(honey?.dot).toContain("--conn-honey");
    expect(honey?.tint).toContain("--conn-honey");
    expect(honey?.border).toContain("--conn-honey");
    expect(honey?.ring).toContain("--conn-honey");
  });

  it("returns null when the color is undefined", () => {
    const missing: ConnectionColor | undefined = undefined;
    expect(getConnectionColorClasses(missing)).toBeNull();
  });
});

describe("getEnvironmentStyle", () => {
  it("returns a destructive badge for prod", () => {
    const style = getEnvironmentStyle("prod");
    expect(style?.label).toBe("prod");
    expect(style?.badgeClass).toContain("bg-destructive");
  });

  it("returns a warning badge for staging", () => {
    const style = getEnvironmentStyle("staging");
    expect(style?.label).toBe("staging");
    expect(style?.badgeClass).toContain("warning");
  });

  it("returns a muted badge for dev", () => {
    const style = getEnvironmentStyle("dev");
    expect(style?.label).toBe("dev");
    expect(style?.badgeClass).toContain("muted");
  });

  it("returns null when the environment is undefined", () => {
    const missing: ConnectionEnvironment | undefined = undefined;
    expect(getEnvironmentStyle(missing)).toBeNull();
  });
});
