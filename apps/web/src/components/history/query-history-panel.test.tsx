import type { useVirtualizer as UseVirtualizer } from "@tanstack/react-virtual";

import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseConnection } from "@/lib/connections";
import type { HistoryEntry } from "@/lib/persistence";

import { EditorInsertProvider } from "@/contexts/editor-insert-context";

const panelState = { open: false };
const setPanelOpen = vi.fn((next: boolean) => {
  panelState.open = next;
});

vi.mock(import("@/hooks/use-history-panel"), () => ({
  useHistoryPanel: () => ({
    open: panelState.open,
    setOpen: setPanelOpen,
    toggle: () => setPanelOpen(!panelState.open),
  }),
}));

const mockMeasureElement = vi.fn();

const mockVirtualizer = ({ count }: { count: number }) => ({
  getTotalSize: () => count * 72,
  getVirtualItems: () =>
    Array.from({ length: count }, (_, i) => ({
      end: (i + 1) * 72,
      index: i,
      key: i,
      size: 72,
      start: i * 72,
    })),
  measureElement: mockMeasureElement,
  scrollToIndex: vi.fn(),
});

vi.mock(import("@tanstack/react-virtual"), () => ({
  useVirtualizer: mockVirtualizer as unknown as typeof UseVirtualizer,
}));

vi.mock(import("motion/react"), async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    useReducedMotion: () => true,
  };
});

const baseConnection: DatabaseConnection = {
  createdAt: "2024-01-01T00:00:00.000Z",
  database: "app",
  host: "localhost",
  id: "conn-a",
  lastConnectedAt: null,
  name: "Primary Postgres",
  password: "",
  pinned: false,
  port: 5432,
  type: "postgresql",
  username: "postgres",
};

const otherConnection: DatabaseConnection = {
  ...baseConnection,
  id: "conn-b",
  name: "Warehouse MySQL",
  type: "mysql",
};

const noopRefresh = async () => {
  await Promise.resolve();
};

const mockConnections = vi.fn<() => Promise<DatabaseConnection[]>>(async () => {
  await Promise.resolve();
  return [baseConnection, otherConnection];
});

vi.mock(import("@/lib/connections"), async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    getConnections: () => mockConnections(),
  };
});

const mockUseAllQueryHistory = vi.fn<
  () => {
    entries: HistoryEntry[];
    error: string | null;
    isLoading: boolean;
    refresh: () => Promise<void>;
  }
>(() => ({
  entries: [],
  error: null,
  isLoading: false,
  refresh: noopRefresh,
}));

vi.mock(import("@/hooks/use-all-query-history"), () => ({
  useAllQueryHistory: () => mockUseAllQueryHistory(),
}));

const makeEntry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  connectionId: "conn-a",
  database: "public",
  dialect: "postgresql",
  error: null,
  executionTimeMs: 12,
  sql: "SELECT 1",
  success: true,
  timestamp: "2026-01-01T12:00:00.000Z",
  ...overrides,
});

const { QueryHistoryPanel } = await import("./query-history-panel");

const openPanel = () => {
  act(() => {
    panelState.open = true;
  });
};

const resetPanel = () => {
  panelState.open = false;
  setPanelOpen.mockClear();
  mockUseAllQueryHistory.mockReset();
  mockUseAllQueryHistory.mockImplementation(() => ({
    entries: [],
    error: null,
    isLoading: false,
    refresh: noopRefresh,
  }));
};

describe("queryHistoryPanel", () => {
  it("renders rows and shows the result count", async () => {
    resetPanel();
    const entries = [
      makeEntry({
        sql: "SELECT * FROM users",
        timestamp: "2026-01-02T00:00:00.000Z",
      }),
      makeEntry({
        connectionId: "conn-b",
        dialect: "mysql",
        sql: "SELECT * FROM orders",
        timestamp: "2026-01-01T00:00:00.000Z",
      }),
    ];
    mockUseAllQueryHistory.mockImplementation(() => ({
      entries,
      error: null,
      isLoading: false,
      refresh: noopRefresh,
    }));

    openPanel();
    render(
      <EditorInsertProvider>
        <QueryHistoryPanel />
      </EditorInsertProvider>
    );

    await expect(
      screen.findByRole("complementary", { name: /query history/i })
    ).resolves.toBeTruthy();
    await expect(screen.findByText(/2 queries/i)).resolves.toBeTruthy();
    expect(screen.getByText(/select \* from users/i)).toBeTruthy();
    expect(screen.getByText(/select \* from orders/i)).toBeTruthy();
  });

  it("focuses a row on click without closing, and opens + closes on double-click", async () => {
    resetPanel();
    const user = userEvent.setup();
    const entry = makeEntry({ sql: "SELECT * FROM users" });
    mockUseAllQueryHistory.mockImplementation(() => ({
      entries: [entry],
      error: null,
      isLoading: false,
      refresh: noopRefresh,
    }));

    openPanel();
    render(
      <EditorInsertProvider>
        <QueryHistoryPanel />
      </EditorInsertProvider>
    );

    const row = await screen.findByRole("option", {
      name: /query from primary postgres/i,
    });

    await user.click(row);
    expect(setPanelOpen).not.toHaveBeenCalledWith(false);
    await expect(
      screen.findByLabelText(/query preview/i)
    ).resolves.toBeTruthy();

    await user.dblClick(row);
    expect(setPanelOpen).toHaveBeenCalledWith(false);
  });

  it("shows empty state when there are no entries", async () => {
    resetPanel();

    openPanel();
    render(
      <EditorInsertProvider>
        <QueryHistoryPanel />
      </EditorInsertProvider>
    );

    await expect(
      screen.findByText(/no matching queries/i)
    ).resolves.toBeTruthy();
  });

  it("shows error state with a retry button", async () => {
    resetPanel();
    mockUseAllQueryHistory.mockImplementation(() => ({
      entries: [],
      error: "keyring locked",
      isLoading: false,
      refresh: noopRefresh,
    }));

    openPanel();
    render(
      <EditorInsertProvider>
        <QueryHistoryPanel />
      </EditorInsertProvider>
    );

    await expect(
      screen.findByText(/history didn't load/i)
    ).resolves.toBeTruthy();
    expect(screen.getByText(/keyring locked/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy();
  });
});
