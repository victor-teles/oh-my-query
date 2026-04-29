import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { NarrativeState } from "@/hooks/use-explain-ai-narrative";
import type { ExplainResult } from "@/lib/tauri";

import { useEditorInsert } from "@/contexts/editor-insert-context";
import { useExplainAiNarrative } from "@/hooks/use-explain-ai-narrative";

import { ExplainAiNarrative } from "./explain-ai-narrative";

vi.mock("@/hooks/use-explain-ai-narrative");
vi.mock("@/contexts/editor-insert-context");

const mockAnalyze = vi.fn();
const mockStop = vi.fn();
const mockReset = vi.fn();
const mockInsertAtCursor = vi.fn();

const setupMocks = (stateOverrides: Partial<NarrativeState> = {}) => {
  const state: NarrativeState = {
    errorMessage: null,
    resultKey: null,
    status: "idle",
    text: "",
    ...stateOverrides,
  };
  vi.mocked(useExplainAiNarrative).mockReturnValue({
    analyze: mockAnalyze,
    reset: mockReset,
    state,
    stop: mockStop,
  });
  vi.mocked(useEditorInsert).mockReturnValue({
    focusEditor: vi.fn(),
    getSelectedText: vi.fn(),
    hasSelection: vi.fn(),
    insertAtCursor: mockInsertAtCursor,
    jumpTo: vi.fn(),
    openQuery: vi.fn(),
    openQueryAndRun: vi.fn(),
    queryTable: vi.fn(),
    registerEditor: vi.fn(),
    registerOpenQuery: vi.fn(),
    registerOpenQueryAndRun: vi.fn(),
    registerQueryTable: vi.fn(),
    replaceSelection: vi.fn(),
  });
};

const makeResult = (): ExplainResult => ({
  analyzeRan: false,
  engine: "postgresql",
  executionTimeMs: 10,
  raw: "Seq Scan on users",
  root: {
    children: [],
    cost: { actualTotalMs: 10, selfMs: 10, startup: null, total: null },
    details: [],
    id: "root",
    label: "Seq Scan on users",
    nodeType: "Seq Scan",
    rows: { actual: 1000, estimated: 1 },
    timing: { actualTotalMs: 10, loops: 1, startupMs: null },
    warnings: [],
  },
  supportsAnalyze: true,
});

describe("explainAiNarrative", () => {
  it("shows Analyze button in idle state", () => {
    setupMocks({ status: "idle" });
    render(<ExplainAiNarrative result={makeResult()} sql="SELECT 1" />);
    expect(
      screen.getByRole("button", { name: /analyze query plan/i })
    ).toBeDefined();
  });

  it("calls analyze when Analyze button is clicked", async () => {
    setupMocks({ status: "idle" });
    render(<ExplainAiNarrative result={makeResult()} sql="SELECT 1" />);
    await userEvent.click(
      screen.getByRole("button", { name: /analyze query plan/i })
    );
    expect(mockAnalyze).toHaveBeenCalledWith(
      expect.objectContaining({ engine: "postgresql" }),
      "SELECT 1"
    );
  });

  it("shows Stop button while streaming", () => {
    setupMocks({ status: "streaming", text: "Diagnosis: slow scan" });
    render(<ExplainAiNarrative result={makeResult()} sql="SELECT 1" />);
    expect(
      screen.getByRole("button", { name: /stop analysis/i })
    ).toBeDefined();
  });

  it("shows streaming text during streaming", () => {
    setupMocks({
      status: "streaming",
      text: "Diagnosis: sequential scan bottleneck",
    });
    render(<ExplainAiNarrative result={makeResult()} sql="SELECT 1" />);
    expect(screen.getByText(/sequential scan bottleneck/i)).toBeDefined();
  });

  it("shows Insert into editor button for SQL blocks when done", () => {
    const text =
      "**Diagnosis:** slow.\n\n**Suggested index:**\n```sql\nCREATE INDEX idx ON users(id);\n```";
    setupMocks({ status: "done", text });
    render(<ExplainAiNarrative result={makeResult()} sql="SELECT 1" />);
    expect(
      screen.getByRole("button", { name: /insert into editor/i })
    ).toBeDefined();
  });

  it("inserts SQL into editor when Insert button is clicked", async () => {
    const sqlCode = "CREATE INDEX idx ON users(id);";
    const text = `**Suggested index:**\n\`\`\`sql\n${sqlCode}\n\`\`\``;
    setupMocks({ status: "done", text });
    render(<ExplainAiNarrative result={makeResult()} sql="SELECT 1" />);
    await userEvent.click(
      screen.getByRole("button", { name: /insert into editor/i })
    );
    expect(mockInsertAtCursor).toHaveBeenCalledWith(
      expect.stringContaining(sqlCode)
    );
  });

  it("shows error message in error state", () => {
    setupMocks({ errorMessage: "Invalid API key.", status: "error" });
    render(<ExplainAiNarrative result={makeResult()} sql="SELECT 1" />);
    expect(screen.getByText(/Invalid API key/i)).toBeDefined();
  });

  it("shows Re-analyze button after error", () => {
    setupMocks({ errorMessage: "Network error.", status: "error" });
    render(<ExplainAiNarrative result={makeResult()} sql="SELECT 1" />);
    expect(screen.getByRole("button", { name: /re-analyze/i })).toBeDefined();
  });

  it("shows loading indicator during loading", () => {
    setupMocks({ status: "loading" });
    render(<ExplainAiNarrative result={makeResult()} sql="SELECT 1" />);
    expect(screen.getByText(/analyzing plan/i)).toBeDefined();
  });

  it("renders HTML in narrative text as literal characters, not markup", () => {
    const text =
      "Look at <script>alert('xss')</script> and **bold** in the output.";
    setupMocks({ status: "done", text });
    const { container } = render(
      <ExplainAiNarrative result={makeResult()} sql="SELECT 1" />
    );
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText(/<script>alert\('xss'\)<\/script>/)).toBeDefined();
    expect(screen.getByText("bold").tagName).toBe("STRONG");
  });

  it("shows an idle hint before the user clicks Analyze", () => {
    setupMocks({ status: "idle" });
    render(<ExplainAiNarrative result={makeResult()} sql="SELECT 1" />);
    expect(
      screen.getByText(/diagnose the plan and suggest fixes/i)
    ).toBeDefined();
  });

  it("renders streaming output with role=status and aria-live=polite", () => {
    setupMocks({ status: "streaming", text: "Diagnosis: hot path" });
    render(<ExplainAiNarrative result={makeResult()} sql="SELECT 1" />);
    const live = screen.getByRole("status");
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.textContent).toContain("hot path");
  });

  it("renders SqlBlock during streaming once the closing fence arrives", () => {
    const text = "**Suggested index:**\n```sql\nCREATE INDEX foo;\n```";
    setupMocks({ status: "streaming", text });
    render(<ExplainAiNarrative result={makeResult()} sql="SELECT 1" />);
    expect(
      screen.getByRole("button", { name: /insert into editor/i })
    ).toBeDefined();
  });

  it("renders error state with role=alert and AlertTriangle icon", () => {
    setupMocks({ errorMessage: "Network error.", status: "error" });
    const { container } = render(
      <ExplainAiNarrative result={makeResult()} sql="SELECT 1" />
    );
    const alert = screen.getByRole("alert");
    expect(alert.getAttribute("aria-live")).toBe("assertive");
    expect(alert.textContent).toContain("Network error.");
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("renders numbered list lines with the marker as a separate column", () => {
    const text = "**Fixes:**\n1. Add an index on user_id\n2. Use partial scan";
    setupMocks({ status: "done", text });
    render(<ExplainAiNarrative result={makeResult()} sql="SELECT 1" />);
    expect(screen.getByText("1.")).toBeDefined();
    expect(screen.getByText("2.")).toBeDefined();
    expect(screen.getByText(/Add an index on user_id/)).toBeDefined();
  });
});
