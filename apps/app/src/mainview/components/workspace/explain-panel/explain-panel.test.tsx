import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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
    render(<ExplainHeader {...baseProps} canImproveWithAi={false} />);
    expect(
      screen.queryByRole("button", { name: /improve query with ai/i })
    ).toBeNull();
  });

  it("shows the button when canImproveWithAi is true", () => {
    render(<ExplainHeader {...baseProps} canImproveWithAi={true} />);
    expect(
      screen.getByRole("button", { name: /improve query with ai/i })
    ).toBeDefined();
  });

  it("calls onImprove when the button is clicked", async () => {
    const onImprove = vi.fn();
    render(
      <ExplainHeader
        {...baseProps}
        canImproveWithAi={true}
        onImprove={onImprove}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: /improve query with ai/i })
    );
    expect(onImprove).toHaveBeenCalledOnce();
  });
});
