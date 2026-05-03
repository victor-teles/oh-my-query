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

describe("explainHeader view + density toggle", () => {
  it("hides the toggle when showViewToggle is false", () => {
    const screen = render(
      <ExplainHeader {...baseProps} showViewToggle={false} />
    );
    expect(screen.getByRole("button", { name: "Tree" }).query()).toBeNull();
    expect(screen.getByRole("button", { name: "Compact" }).query()).toBeNull();
    expect(screen.getByRole("button", { name: "Raw" }).query()).toBeNull();
  });

  it("selects compact density and tree view when Compact is clicked", async () => {
    const onViewChange = vi.fn();
    const onDensityChange = vi.fn();
    const screen = render(
      <ExplainHeader
        {...baseProps}
        onDensityChange={onDensityChange}
        onViewChange={onViewChange}
        showViewToggle={true}
      />
    );
    await screen.getByRole("button", { name: "Compact" }).click();
    expect(onViewChange).toHaveBeenCalledWith("tree");
    expect(onDensityChange).toHaveBeenCalledWith("compact");
  });

  it("selects comfortable density and tree view when Tree is clicked", async () => {
    const onViewChange = vi.fn();
    const onDensityChange = vi.fn();
    const screen = render(
      <ExplainHeader
        {...baseProps}
        density="compact"
        onDensityChange={onDensityChange}
        onViewChange={onViewChange}
        showViewToggle={true}
      />
    );
    await screen.getByRole("button", { name: "Tree" }).click();
    expect(onViewChange).toHaveBeenCalledWith("tree");
    expect(onDensityChange).toHaveBeenCalledWith("comfortable");
  });

  it("preserves density when switching to Raw", async () => {
    const onViewChange = vi.fn();
    const onDensityChange = vi.fn();
    const screen = render(
      <ExplainHeader
        {...baseProps}
        density="compact"
        onDensityChange={onDensityChange}
        onViewChange={onViewChange}
        showViewToggle={true}
      />
    );
    await screen.getByRole("button", { name: "Raw" }).click();
    expect(onViewChange).toHaveBeenCalledWith("raw");
    expect(onDensityChange).not.toHaveBeenCalled();
  });

  it("marks Compact as pressed when in tree view + compact density", () => {
    const screen = render(
      <ExplainHeader
        {...baseProps}
        density="compact"
        showViewToggle={true}
        viewMode="tree"
      />
    );
    expect(
      screen.getByRole("button", { name: "Compact" }).element()
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Tree" }).element()
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: "Raw" }).element()
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("marks Raw as pressed regardless of density", () => {
    const screen = render(
      <ExplainHeader
        {...baseProps}
        density="compact"
        showViewToggle={true}
        viewMode="raw"
      />
    );
    expect(
      screen.getByRole("button", { name: "Raw" }).element()
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Compact" }).element()
    ).toHaveAttribute("aria-pressed", "false");
  });
});
