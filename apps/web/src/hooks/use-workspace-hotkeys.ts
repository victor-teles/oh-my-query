import { useHotkey } from "@tanstack/react-hotkeys";

import type { QueryTab } from "@/lib/query-types";

interface WorkspaceHotkeysParams {
  tabs: QueryTab[];
  activeTab: QueryTab | undefined;
  addTab: () => void;
  closeTab: (tabId: string) => void;
  setActiveTabId: (id: string) => void;
  handleFormat: () => void;
}

export const useWorkspaceHotkeys = ({
  tabs,
  activeTab,
  addTab,
  closeTab,
  setActiveTabId,
  handleFormat,
}: WorkspaceHotkeysParams) => {
  useHotkey("Mod+Shift+F", () => {
    handleFormat();
  });

  useHotkey("Mod+T", () => {
    addTab();
  });

  useHotkey("Mod+W", () => {
    if (activeTab) {
      closeTab(activeTab.id);
    }
  });

  useHotkey("Mod+1", () => {
    if (tabs[0]) {
      setActiveTabId(tabs[0].id);
    }
  });

  useHotkey("Mod+2", () => {
    if (tabs[1]) {
      setActiveTabId(tabs[1].id);
    }
  });

  useHotkey("Mod+3", () => {
    if (tabs[2]) {
      setActiveTabId(tabs[2].id);
    }
  });

  useHotkey("Mod+4", () => {
    if (tabs[3]) {
      setActiveTabId(tabs[3].id);
    }
  });

  useHotkey("Mod+5", () => {
    if (tabs[4]) {
      setActiveTabId(tabs[4].id);
    }
  });

  useHotkey("Mod+6", () => {
    if (tabs[5]) {
      setActiveTabId(tabs[5].id);
    }
  });

  useHotkey("Mod+7", () => {
    if (tabs[6]) {
      setActiveTabId(tabs[6].id);
    }
  });

  useHotkey("Mod+8", () => {
    if (tabs[7]) {
      setActiveTabId(tabs[7].id);
    }
  });

  useHotkey("Mod+9", () => {
    if (tabs[8]) {
      setActiveTabId(tabs[8].id);
    }
  });
};
