import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { ConnectionGlyph } from "./connection-glyph";

describe("connectionGlyph", () => {
  it("shows the chosen emoji", async () => {
    const screen = render(
      <ConnectionGlyph connection={{ emoji: "🧪", type: "duckdb" }} />
    );
    await expect.element(screen.getByText("🧪")).toBeInTheDocument();
  });

  it("falls back to the database type's emoji", async () => {
    const screen = render(
      <ConnectionGlyph connection={{ type: "postgresql" }} />
    );
    await expect.element(screen.getByText("🐘")).toBeInTheDocument();
  });

  it("shows a color dot when only a color is set", () => {
    const screen = render(
      <ConnectionGlyph connection={{ color: "moss", type: "mysql" }} />
    );
    expect(screen.container.textContent).toBe("");
    expect(screen.container.innerHTML).toContain("--conn-moss");
  });
});
