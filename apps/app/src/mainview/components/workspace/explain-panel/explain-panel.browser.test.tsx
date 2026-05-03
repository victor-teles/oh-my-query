import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { ExplainHeader } from "./explain-panel";

const baseProps = {
  analyze: false,
  analyzeSupported: true,
  canImproveWithAi: false,
  canRun: true,
  engine: "postgresql",
  hasSelection: false,
  isRunning: false,
  onCancel: vi.fn(),
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
