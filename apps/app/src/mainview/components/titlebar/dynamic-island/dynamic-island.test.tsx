import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  IslandSnapshot,
  RunningQueryEntry,
} from "@/contexts/island-context";

import { DynamicIslandContent } from "./dynamic-island-content";

const renderSnapshot = (snapshot: IslandSnapshot) =>
  render(<DynamicIslandContent snapshot={snapshot} />);

const makeRunner = (
  overrides: Partial<RunningQueryEntry> = {}
): RunningQueryEntry => ({
  connectionColor: undefined,
  connectionEmoji: undefined,
  connectionEnvironment: undefined,
  connectionId: "conn-1",
  connectionLabel: "my-db",
  onCancel: vi.fn(),
  startedAt: Date.now(),
  tabId: "tab-1",
  tabTitle: "Untitled",
  ...overrides,
});

const makeRunning = (runners: RunningQueryEntry[]): IslandSnapshot => ({
  headlineTabId: runners[0]?.tabId ?? "",
  kind: "query-running",
  onCancelAll: vi.fn(),
  onCancelHeadline: runners[0]?.onCancel ?? vi.fn(),
  runners,
});

describe("dynamicIslandContent", () => {
  describe("connection states", () => {
    it("renders welcome state", () => {
      renderSnapshot({ kind: "welcome" });
      expect(screen.getByText("Welcome")).toBeDefined();
    });

    it("renders ambient state with connection name", () => {
      renderSnapshot({ connectionName: "my-db", kind: "ambient" });
      expect(screen.getByText("my-db")).toBeDefined();
    });

    it("renders connecting state with sr label and connection name", () => {
      renderSnapshot({ connectionName: "prod-pg", kind: "connecting" });
      expect(screen.getByText("Connecting to")).toBeDefined();
      expect(screen.getByText("prod-pg")).toBeDefined();
    });

    it("renders reconnecting state with connection name", () => {
      renderSnapshot({ connectionName: "staging", kind: "reconnecting" });
      expect(screen.getByText("Reconnecting to staging")).toBeDefined();
    });

    it("renders connection-error with retry button", () => {
      const onReconnect = vi.fn();
      renderSnapshot({
        error: "ECONNREFUSED",
        kind: "connection-error",
        onReconnect,
      });
      expect(screen.getByRole("button", { name: /retry/i })).toBeDefined();
    });

    it("renders connected-idle with accessible label", () => {
      renderSnapshot({
        color: "honey",
        connectionName: "analytics",
        database: "app",
        emoji: undefined,
        environment: undefined,
        kind: "connected-idle",
        serverVersion: "15.1",
        username: "admin",
      });
      expect(
        screen.getByRole("button", { name: /Connected to analytics/i })
      ).toBeDefined();
    });
  });

  describe("query states", () => {
    it("renders query-running with executing label", () => {
      renderSnapshot(makeRunning([makeRunner()]));
      expect(screen.getByText("Executing query")).toBeDefined();
      expect(screen.getByText("Running")).toBeDefined();
    });

    it("renders trigger button that opens the picker", () => {
      renderSnapshot(makeRunning([makeRunner({ tabTitle: "First" })]));
      expect(
        screen.getByRole("button", { name: /show running query/i })
      ).toBeDefined();
    });

    it("renders elapsed time after threshold", () => {
      renderSnapshot(
        makeRunning([makeRunner({ startedAt: Date.now() - 4200 })])
      );
      expect(screen.getByText(/4\.\ds/)).toBeDefined();
    });

    it("renders +N-1 count chip when 2 or more runners", () => {
      renderSnapshot(
        makeRunning([
          makeRunner({ tabId: "t1", tabTitle: "First" }),
          makeRunner({ tabId: "t2", tabTitle: "Second" }),
          makeRunner({ tabId: "t3", tabTitle: "Third" }),
        ])
      );
      expect(screen.getByText("+2")).toBeDefined();
    });

    it("hides +N-1 chip with single runner", () => {
      renderSnapshot(makeRunning([makeRunner()]));
      expect(screen.queryByText(/^\+\d+$/)).toBeNull();
    });

    it("renders query-success with row count and time", () => {
      renderSnapshot({
        executionTimeMs: 250,
        kind: "query-success",
        rowCount: 42,
      });
      expect(screen.getByText("42")).toBeDefined();
      expect(screen.getByText("rows")).toBeDefined();
      expect(screen.getByText("250ms")).toBeDefined();
    });

    it("renders query-success with singular row label", () => {
      renderSnapshot({
        executionTimeMs: 10,
        kind: "query-success",
        rowCount: 1,
      });
      expect(screen.getByText("row")).toBeDefined();
    });

    it("renders query-error with sr label", () => {
      renderSnapshot({
        error: "syntax error at position 1",
        kind: "query-error",
      });
      expect(screen.getByText("Query failed:")).toBeDefined();
    });
  });

  describe("aI states", () => {
    it("renders query-streaming with streaming label", () => {
      renderSnapshot({ kind: "query-streaming", tokensReceived: 64 });
      expect(screen.getByText("Streaming AI response")).toBeDefined();
    });

    it("renders query-streaming shows token count when non-zero", () => {
      renderSnapshot({ kind: "query-streaming", tokensReceived: 64 });
      expect(screen.getByText(/64/)).toBeDefined();
    });

    it("renders query-streaming without token count when zero", () => {
      renderSnapshot({ kind: "query-streaming", tokensReceived: 0 });
      expect(screen.queryByText("· 0")).toBeNull();
    });

    it("renders query-planning with planning label", () => {
      renderSnapshot({ kind: "query-planning" });
      expect(screen.getByText("AI planning query")).toBeDefined();
    });

    it("renders query-cancelled with cancelled label", () => {
      renderSnapshot({ kind: "query-cancelled" });
      expect(screen.getByText("Query cancelled")).toBeDefined();
    });
  });

  describe("accessibility", () => {
    it("retry button is keyboard accessible in connection-error", () => {
      const onReconnect = vi.fn();
      renderSnapshot({
        error: "conn refused",
        kind: "connection-error",
        onReconnect,
      });
      const btn = screen.getByRole("button", { name: /retry/i });
      expect(btn).toBeDefined();
    });

    it("sr-only labels are present for query-running", () => {
      renderSnapshot(makeRunning([makeRunner()]));
      expect(screen.getByText("Executing query")).toBeDefined();
    });

    it("running trigger advertises listbox popup via aria-haspopup", () => {
      renderSnapshot(makeRunning([makeRunner()]));
      const btn = screen.getByRole("button", { name: /show running query/i });
      expect(btn.getAttribute("aria-haspopup")).toBe("listbox");
      expect(btn.getAttribute("aria-expanded")).toBe("false");
    });

    it("cancel button on streaming labels as Stop generating", () => {
      renderSnapshot({
        kind: "query-streaming",
        onCancel: vi.fn(),
        tokensReceived: 64,
      });
      expect(
        screen.getByRole("button", { name: /stop generating/i })
      ).toBeDefined();
    });

    it("cancel button on planning labels as Stop planning", () => {
      renderSnapshot({ kind: "query-planning", onCancel: vi.fn() });
      expect(
        screen.getByRole("button", { name: /stop planning/i })
      ).toBeDefined();
    });

    it("sr-only cancelled label is present", () => {
      renderSnapshot({ kind: "query-cancelled" });
      expect(screen.getByText("Query cancelled")).toBeDefined();
    });

    it("sr-only streaming label is present", () => {
      renderSnapshot({ kind: "query-streaming", tokensReceived: 0 });
      expect(screen.getByText("Streaming AI response")).toBeDefined();
    });

    it("sr-only planning label is present", () => {
      renderSnapshot({ kind: "query-planning" });
      expect(screen.getByText("AI planning query")).toBeDefined();
    });
  });
});
