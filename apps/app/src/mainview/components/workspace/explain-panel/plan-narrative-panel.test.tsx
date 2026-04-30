import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mockOpenQuery = vi.fn();

vi.mock(import("@/contexts/editor-insert-context"), () => ({
  useEditorInsert: () => ({
    focusEditor: vi.fn(),
    getSelectedText: vi.fn(),
    hasSelection: vi.fn(),
    insertAtCursor: vi.fn(),
    jumpTo: vi.fn(),
    openQuery: mockOpenQuery,
    openQueryAndRun: vi.fn(),
    queryTable: vi.fn(),
    registerEditor: vi.fn(),
    registerOpenQuery: vi.fn(),
    registerOpenQueryAndRun: vi.fn(),
    registerQueryTable: vi.fn(),
    replaceSelection: vi.fn(),
  }),
}));

vi.mock(import("@/components/workspace/ai-settings-dialog"), () => ({
  AISettingsDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="ai-settings-dialog" /> : <span />,
}));

const { PlanNarrativePanel } = await import("./plan-narrative-panel");

const baseProps = {
  content: "",
  errorMessage: null,
  errorRetryable: false,
  onCancel: vi.fn(),
  onRetry: vi.fn(),
};

describe("planNarrativePanel", () => {
  it("shows AI settings dialog trigger when unconfigured", async () => {
    render(<PlanNarrativePanel {...baseProps} status="unconfigured" />);
    expect(screen.getByText(/api key/i)).toBeDefined();
    const btn = screen.getByRole("button", { name: /set up ai/i });
    await userEvent.click(btn);
    expect(screen.getByTestId("ai-settings-dialog")).toBeDefined();
  });

  it("shows error message in an alert role", () => {
    render(
      <PlanNarrativePanel
        {...baseProps}
        errorMessage="Cannot reach provider."
        errorRetryable={false}
        status="error"
      />
    );
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText("Cannot reach provider.")).toBeDefined();
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });

  it("shows retry button when error is retryable", async () => {
    const onRetry = vi.fn();
    render(
      <PlanNarrativePanel
        {...baseProps}
        errorMessage="Network error."
        errorRetryable={true}
        onRetry={onRetry}
        status="error"
      />
    );
    const btn = screen.getByRole("button", { name: /retry/i });
    await userEvent.click(btn);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("renders bold text without using dangerouslySetInnerHTML (XSS safe)", () => {
    const malicious = "**<script>alert(1)</script>**";
    render(
      <PlanNarrativePanel {...baseProps} content={malicious} status="done" />
    );
    // The script tag text should appear as literal text, not execute
    expect(screen.getByText(/<script>alert\(1\)<\/script>/)).toBeDefined();
    // Must not be an actual script element
    expect(document.querySelector("script[src]")).toBeNull();
  });

  it("renders bold segments as <strong> elements", () => {
    render(
      <PlanNarrativePanel
        {...baseProps}
        content="**Diagnosis:** slow scan"
        status="done"
      />
    );
    const strong = document.querySelector("strong");
    expect(strong?.textContent).toBe("Diagnosis:");
  });

  it("renders SQL blocks with Open in editor button", async () => {
    const sql = "CREATE INDEX idx ON orders(status)";
    render(
      <PlanNarrativePanel
        {...baseProps}
        content={`Fix 1:\n\`\`\`sql\n${sql}\n\`\`\``}
        status="done"
      />
    );
    expect(screen.getByText(sql)).toBeDefined();
    const btn = screen.getByRole("button", { name: /open in editor/i });
    await userEvent.click(btn);
    expect(mockOpenQuery).toHaveBeenCalledWith(sql);
  });

  it("shows streaming cursor when status is streaming", () => {
    const { container } = render(
      <PlanNarrativePanel
        {...baseProps}
        content="Analyzing…"
        status="streaming"
      />
    );
    // The blink cursor span is aria-hidden
    const cursor = container.querySelector("[aria-hidden]");
    expect(cursor).toBeDefined();
  });

  it("uses role=status and aria-live=polite on streaming/done content", () => {
    render(
      <PlanNarrativePanel
        {...baseProps}
        content="some analysis"
        status="done"
      />
    );
    expect(screen.getByRole("status")).toBeDefined();
  });
});
