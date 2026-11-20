import { describe, expect, it } from "vitest";

import { PERIOD } from "@/test/board-fixtures";

import {
  countLabel,
  engineLabel,
  exportedLabel,
  exportedOnLabel,
  importActionLabel,
  importedLabel,
  paramSummary,
} from "./bundle-labels";

describe("bundle labels", () => {
  it("pluralizes counts", () => {
    expect(countLabel(1, "widget")).toBe("1 widget");
    expect(countLabel(0, "board")).toBe("0 boards");
  });

  it("names the import action, or nothing when nothing is selected", () => {
    expect(importActionLabel({ boards: 1, widgets: 5 })).toBe(
      "Import 5 widgets, 1 board"
    );
    expect(importActionLabel({ boards: 2, widgets: 0 })).toBe(
      "Import 2 boards"
    );
    expect(importActionLabel({ boards: 0, widgets: 0 })).toBeNull();
  });

  it("summarizes an export and an import", () => {
    expect(exportedLabel({ boards: 2, widgets: 6 })).toBe(
      "Exported 6 widgets, 2 boards"
    );
    expect(exportedLabel({ boards: 0, widgets: 1 })).toBe("Exported 1 widget");
    expect(importedLabel({ boards: 1, widgets: 3 })).toBe(
      "Imported 3 widgets and 1 board."
    );
    expect(importedLabel({ boards: 0, widgets: 0 })).toBe(
      "Nothing was imported."
    );
  });

  it("labels known engines and passes unknown ones through", () => {
    expect(engineLabel("postgresql")).toBe("PostgreSQL");
    expect(engineLabel("snowflake")).toBe("snowflake");
  });

  it("summarizes the editable inputs", () => {
    expect(
      paramSummary([
        PERIOD,
        { ...PERIOD, fixed: true, label: "Hidden", name: "hidden" },
      ])
    ).toBe("Inputs: Period");
    expect(paramSummary([])).toBe("No inputs");
  });

  it("formats the export date, ignoring a bad one", () => {
    expect(exportedOnLabel("2026-11-20T09:00:00.000Z")).toBe(
      "Exported Nov 20, 2026"
    );
    expect(exportedOnLabel("yesterday")).toBeNull();
  });
});
