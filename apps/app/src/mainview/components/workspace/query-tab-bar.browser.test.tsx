import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { QueryTab, TabStatus } from "@/lib/query-types";

import { QueryTabBar } from "./query-tab-bar";

const tab = (overrides: Partial<QueryTab> = {}): QueryTab => ({
  error: null,
  errorCode: null,
  executedSql: null,
  explainAnalyze: false,
  explainDensity: "comfortable",
  explainError: null,
  explainResult: null,
  explainSql: null,
  explainStatus: "idle",
  id: "t1",
  pendingExecution: null,
  result: null,
  runningExplainId: null,
  runningQueryId: null,
  sourceDialect: null,
  sql: "",
  status: "idle",
  title: "Tab 1",
  ...overrides,
});

const renderBar = (
  overrides: Partial<React.ComponentProps<typeof QueryTabBar>> = {}
) =>
  render(
    <QueryTabBar
      activeTabId={overrides.activeTabId ?? "t1"}
      onAddTab={overrides.onAddTab ?? vi.fn()}
      onCloseTab={overrides.onCloseTab ?? vi.fn()}
      onSelectTab={overrides.onSelectTab ?? vi.fn()}
      tabs={
        overrides.tabs ?? [
          tab({ id: "t1", title: "First" }),
          tab({ id: "t2", title: "Second" }),
        ]
      }
    />
  );

describe("query-tab-bar", () => {
  it("renders one tab per entry", () => {
    const screen = renderBar();

    expect(screen.getByRole("tab", { name: /first/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /second/i })).toBeInTheDocument();
  });

  it("marks the active tab via aria-selected", () => {
    const screen = renderBar({ activeTabId: "t2" });

    expect(
      screen.getByRole("tab", { name: /first/i }).element()
    ).toHaveAttribute("aria-selected", "false");
    expect(
      screen.getByRole("tab", { name: /second/i }).element()
    ).toHaveAttribute("aria-selected", "true");
  });

  it("calls onSelectTab with the new tab id when a tab is clicked", async () => {
    const onSelectTab = vi.fn();
    const screen = renderBar({ onSelectTab });

    await screen.getByRole("tab", { name: /second/i }).click();
    expect(onSelectTab).toHaveBeenCalledWith("t2");
  });

  it("calls onCloseTab with the tab id and stops propagation", async () => {
    const onSelectTab = vi.fn();
    const onCloseTab = vi.fn();
    const screen = renderBar({ onCloseTab, onSelectTab });

    await screen.getByRole("button", { name: /close first/i }).click();

    expect(onCloseTab).toHaveBeenCalledExactlyOnceWith("t1");
    expect(onSelectTab).not.toHaveBeenCalled();
  });

  it("calls onAddTab from the New tab button", async () => {
    const onAddTab = vi.fn();
    const screen = renderBar({ onAddTab });

    await screen.getByRole("button", { name: /new query tab/i }).click();
    expect(onAddTab).toHaveBeenCalledOnce();
  });

  it.each<TabStatus>(["running", "success", "error"])(
    "exposes aria-description for non-idle status: %s",
    (status) => {
      const screen = render(
        <QueryTabBar
          activeTabId="t1"
          onAddTab={vi.fn()}
          onCloseTab={vi.fn()}
          onSelectTab={vi.fn()}
          tabs={[tab({ status })]}
        />
      );

      expect(
        screen
          .getByRole("tab", { name: /tab 1/i })
          .element()
          .getAttribute("aria-description")
      ).toBeTruthy();
      screen.unmount();
    }
  );
});
