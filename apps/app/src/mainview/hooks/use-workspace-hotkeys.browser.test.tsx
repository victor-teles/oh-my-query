import type { ReactNode } from "react";

import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { QueryTab } from "@/lib/query-types";

import { useWorkspaceHotkeys } from "@/hooks/use-workspace-hotkeys";

const Wrapper = ({ children }: { children: ReactNode }) => (
  <HotkeysProvider>{children}</HotkeysProvider>
);

interface Props {
  tabs: QueryTab[];
  activeTab: QueryTab | undefined;
  addTab: () => void;
  closeTab: (id: string) => void;
  reopenTab: () => void;
  setActiveTabId: (id: string) => void;
  handleFormat: () => void;
  handleExplain: () => void;
}

const Harness = (props: Props) => {
  useWorkspaceHotkeys(props);
  return <div data-testid="harness" />;
};

const fireKey = (key: string, options: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key,
    metaKey: true,
    ...options,
  });
  document.body.dispatchEvent(event);
};

const baseTab: QueryTab = {
  error: null,
  errorCode: null,
  executedSql: null,
  explainAnalyze: false,
  explainDensity: "comfortable",
  explainError: null,
  explainResult: null,
  explainSql: null,
  explainStatus: "idle",
  id: "tab-1",
  pendingExecution: null,
  result: null,
  runningExplainId: null,
  runningQueryId: null,
  sourceDialect: null,
  sql: "",
  status: "idle",
  title: "Query 1",
};

describe("useWorkspaceHotkeys", () => {
  it("mod+T fires addTab", () => {
    const addTab = vi.fn();
    render(
      <Wrapper>
        <Harness
          activeTab={baseTab}
          addTab={addTab}
          closeTab={vi.fn()}
          handleExplain={vi.fn()}
          handleFormat={vi.fn()}
          reopenTab={vi.fn()}
          setActiveTabId={vi.fn()}
          tabs={[baseTab]}
        />
      </Wrapper>
    );
    fireKey("t");
    expect(addTab).toHaveBeenCalledWith();
  });

  it("mod+W closes the active tab", () => {
    const closeTab = vi.fn();
    render(
      <Wrapper>
        <Harness
          activeTab={baseTab}
          addTab={vi.fn()}
          closeTab={closeTab}
          handleExplain={vi.fn()}
          handleFormat={vi.fn()}
          reopenTab={vi.fn()}
          setActiveTabId={vi.fn()}
          tabs={[baseTab]}
        />
      </Wrapper>
    );
    fireKey("w");
    expect(closeTab).toHaveBeenCalledWith("tab-1");
  });

  it("mod+1 selects the first tab", () => {
    const setActive = vi.fn();
    const tabs = [
      { ...baseTab, id: "a" },
      { ...baseTab, id: "b" },
    ];
    render(
      <Wrapper>
        <Harness
          activeTab={tabs[0]}
          addTab={vi.fn()}
          closeTab={vi.fn()}
          handleExplain={vi.fn()}
          handleFormat={vi.fn()}
          reopenTab={vi.fn()}
          setActiveTabId={setActive}
          tabs={tabs}
        />
      </Wrapper>
    );
    fireKey("1");
    expect(setActive).toHaveBeenCalledWith("a");
  });

  it("mod+Shift+F triggers handleFormat", () => {
    const handleFormat = vi.fn();
    render(
      <Wrapper>
        <Harness
          activeTab={baseTab}
          addTab={vi.fn()}
          closeTab={vi.fn()}
          handleExplain={vi.fn()}
          handleFormat={handleFormat}
          reopenTab={vi.fn()}
          setActiveTabId={vi.fn()}
          tabs={[baseTab]}
        />
      </Wrapper>
    );
    fireKey("F", { shiftKey: true });
    expect(handleFormat).toHaveBeenCalledWith();
  });
});
