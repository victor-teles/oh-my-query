import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { ExplainHeader } from "./explain-panel";

const baseProps = {
  analyze: false,
  analyzeSupported: true,
  canImproveWithAi: false,
  canRun: true,
  density: "comfortable" as const,
  engine: "postgresql",
  hasSelection: false,
  isRunning: false,
  onCancel: vi.fn(),
  onDensityChange: vi.fn(),
  onImprove: vi.fn(),
  onRun: vi.fn(),
  onToggleAnalyze: vi.fn(),
  onViewChange: vi.fn(),
  showDensityToggle: false,
  showViewToggle: false,
  viewMode: "tree" as const,
};

describe("explainHeader Improve with AI button", () => {
  it("hides the button when canImproveWithAi is false", () => {
    const screen = render(
      <ExplainHeader {...baseProps} canImproveWithAi={false} />
    );
    expect(
      screen.getByRole("button", { name: /improve query with ai/i }).query()
    ).toBeNull();
  });

  it("shows the button when canImproveWithAi is true", () => {
    const screen = render(
      <ExplainHeader {...baseProps} canImproveWithAi={true} />
    );
    expect(
      screen.getByRole("button", { name: /improve query with ai/i })
    ).toBeInTheDocument();
  });

  it("calls onImprove when the button is clicked", async () => {
    const onImprove = vi.fn();
    const screen = render(
      <ExplainHeader
        {...baseProps}
        canImproveWithAi={true}
        onImprove={onImprove}
      />
    );
    await screen
      .getByRole("button", { name: /improve query with ai/i })
      .click();
    expect(onImprove).toHaveBeenCalledOnce();
  });
});

describe("explainHeader density toggle", () => {
  it("hides the toggle when showDensityToggle is false", () => {
    const screen = render(
      <ExplainHeader {...baseProps} showDensityToggle={false} />
    );
    expect(screen.getByRole("button", { name: "Comfy" }).query()).toBeNull();
    expect(screen.getByRole("button", { name: "Compact" }).query()).toBeNull();
  });

  it("calls onDensityChange when Compact is clicked", async () => {
    const onDensityChange = vi.fn();
    const screen = render(
      <ExplainHeader
        {...baseProps}
        onDensityChange={onDensityChange}
        showDensityToggle={true}
      />
    );
    await screen.getByRole("button", { name: "Compact" }).click();
    expect(onDensityChange).toHaveBeenCalledWith("compact");
  });

  it("marks the active density button as pressed", () => {
    const screen = render(
      <ExplainHeader
        {...baseProps}
        density="compact"
        showDensityToggle={true}
      />
    );
    expect(
      screen.getByRole("button", { name: "Compact" }).element()
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Comfy" }).element()
    ).toHaveAttribute("aria-pressed", "false");
  });
});
