import { act, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { RunningQueryEntry } from "@/contexts/island-context";

import { IslandRunningQueriesPicker } from "./island-running-queries-picker";

const makeRunner = (
  overrides: Partial<RunningQueryEntry> = {}
): RunningQueryEntry => ({
  connectionColor: undefined,
  connectionEmoji: undefined,
  connectionEnvironment: undefined,
  connectionId: "conn-1",
  connectionLabel: "my-db",
  onCancel: vi.fn(),
  startedAt: Date.now() - 1500,
  tabId: "tab-1",
  tabTitle: "Untitled",
  ...overrides,
});

const renderPicker = (
  runners: RunningQueryEntry[],
  options: {
    headlineTabId?: string;
    onCancelAll?: () => void;
  } = {}
) =>
  render(
    <IslandRunningQueriesPicker
      headlineTabId={options.headlineTabId ?? runners[0]?.tabId ?? ""}
      onCancelAll={options.onCancelAll ?? vi.fn()}
      runners={runners}
    />
  );

describe("islandRunningQueriesPicker", () => {
  describe("trigger pill", () => {
    it("renders trigger button without opening popup by default", () => {
      renderPicker([makeRunner({ tabTitle: "Top users" })]);
      expect(
        screen.getByRole("button", { name: /show running query/i })
      ).toBeDefined();
      expect(screen.queryByRole("listbox")).toBeNull();
    });

    it("shows +N-1 chip when 2 or more runners", () => {
      renderPicker([
        makeRunner({ tabId: "t1", tabTitle: "First" }),
        makeRunner({ tabId: "t2", tabTitle: "Second" }),
        makeRunner({ tabId: "t3", tabTitle: "Third" }),
      ]);
      expect(screen.getByText("+2")).toBeDefined();
    });

    it("does not show count chip with one runner", () => {
      renderPicker([makeRunner()]);
      expect(screen.queryByText(/^\+\d+$/)).toBeNull();
    });
  });

  describe("opening", () => {
    it("opens picker on trigger click and lists rows", async () => {
      const user = userEvent.setup();
      renderPicker([
        makeRunner({ tabId: "t1", tabTitle: "First" }),
        makeRunner({ tabId: "t2", tabTitle: "Second" }),
      ]);
      await user.click(
        screen.getByRole("button", { name: /show 2 running queries/i })
      );
      const listbox = await screen.findByRole("listbox", {
        name: /running queries/i,
      });
      expect(listbox).toBeDefined();
      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(2);
      expect(screen.getByText("First")).toBeDefined();
      expect(screen.getByText("Second")).toBeDefined();
    });

    it("opens picker even with single runner (consistent UX)", async () => {
      const user = userEvent.setup();
      renderPicker([makeRunner({ tabTitle: "Solo" })]);
      await user.click(
        screen.getByRole("button", { name: /show running query/i })
      );
      const options = await screen.findAllByRole("option");
      expect(options).toHaveLength(1);
      expect(screen.getByText("Solo")).toBeDefined();
    });
  });

  describe("cancellation", () => {
    it("clicking row's cancel button calls only that runner's onCancel", async () => {
      const user = userEvent.setup();
      const onCancel1 = vi.fn();
      const onCancel2 = vi.fn();
      const onCancel3 = vi.fn();
      renderPicker([
        makeRunner({ onCancel: onCancel1, tabId: "t1", tabTitle: "First" }),
        makeRunner({ onCancel: onCancel2, tabId: "t2", tabTitle: "Second" }),
        makeRunner({ onCancel: onCancel3, tabId: "t3", tabTitle: "Third" }),
      ]);
      await user.click(
        screen.getByRole("button", { name: /show 3 running queries/i })
      );
      const cancelBtn = await screen.findByRole("button", {
        name: /cancel second/i,
      });
      await user.click(cancelBtn);
      expect(onCancel1).not.toHaveBeenCalled();
      expect(onCancel2).toHaveBeenCalledOnce();
      expect(onCancel3).not.toHaveBeenCalled();
    });

    it("cancel all calls every onCancel exactly once", async () => {
      const user = userEvent.setup();
      const onCancel1 = vi.fn();
      const onCancel2 = vi.fn();
      const onCancel3 = vi.fn();
      const onCancelAll = vi.fn(() => {
        onCancel1();
        onCancel2();
        onCancel3();
      });
      renderPicker(
        [
          makeRunner({ onCancel: onCancel1, tabId: "t1", tabTitle: "First" }),
          makeRunner({ onCancel: onCancel2, tabId: "t2", tabTitle: "Second" }),
          makeRunner({ onCancel: onCancel3, tabId: "t3", tabTitle: "Third" }),
        ],
        { onCancelAll }
      );
      await user.click(
        screen.getByRole("button", { name: /show 3 running queries/i })
      );
      const cancelAllBtn = await screen.findByRole("button", {
        name: /cancel all/i,
      });
      await user.click(cancelAllBtn);
      expect(onCancelAll).toHaveBeenCalledOnce();
      expect(onCancel1).toHaveBeenCalledOnce();
      expect(onCancel2).toHaveBeenCalledOnce();
      expect(onCancel3).toHaveBeenCalledOnce();
    });

    it("cancel all footer is absent for single runner", async () => {
      const user = userEvent.setup();
      renderPicker([makeRunner()]);
      await user.click(
        screen.getByRole("button", { name: /show running query/i })
      );
      await screen.findByRole("listbox");
      expect(screen.queryByRole("button", { name: /cancel all/i })).toBeNull();
    });
  });

  describe("dismissal", () => {
    it("esc key closes picker without calling any onCancel", async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      const onCancelAll = vi.fn();
      renderPicker(
        [
          makeRunner({ onCancel, tabId: "t1", tabTitle: "First" }),
          makeRunner({ tabId: "t2", tabTitle: "Second" }),
        ],
        { onCancelAll }
      );
      await user.click(
        screen.getByRole("button", { name: /show 2 running queries/i })
      );
      await screen.findByRole("listbox");
      await user.keyboard("{Escape}");
      await waitFor(() => {
        expect(screen.queryByRole("listbox")).toBeNull();
      });
      expect(onCancel).not.toHaveBeenCalled();
      expect(onCancelAll).not.toHaveBeenCalled();
    });
  });

  describe("dynamic runners", () => {
    it("auto-closes when runners drain to zero", async () => {
      const user = userEvent.setup();
      const { rerender } = renderPicker([
        makeRunner({ tabId: "t1", tabTitle: "First" }),
        makeRunner({ tabId: "t2", tabTitle: "Second" }),
      ]);
      await user.click(
        screen.getByRole("button", { name: /show 2 running queries/i })
      );
      await screen.findByRole("listbox");

      act(() => {
        rerender(
          <IslandRunningQueriesPicker
            headlineTabId=""
            onCancelAll={vi.fn()}
            runners={[]}
          />
        );
      });

      await waitFor(() => {
        expect(screen.queryByRole("listbox")).toBeNull();
      });
    });

    it("renders nothing when runners is empty (degenerate guard)", () => {
      const { container } = renderPicker([]);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("keyboard navigation", () => {
    it("arrowDown moves focus to next row", async () => {
      const user = userEvent.setup();
      renderPicker([
        makeRunner({ tabId: "t1", tabTitle: "First" }),
        makeRunner({ tabId: "t2", tabTitle: "Second" }),
        makeRunner({ tabId: "t3", tabTitle: "Third" }),
      ]);
      await user.click(
        screen.getByRole("button", { name: /show 3 running queries/i })
      );
      await screen.findByRole("listbox");
      const options = screen.getAllByRole("option");
      await waitFor(() => {
        expect(options[0]?.getAttribute("aria-selected")).toBe("true");
      });
      await user.keyboard("{ArrowDown}");
      await waitFor(() => {
        expect(options[1]?.getAttribute("aria-selected")).toBe("true");
      });
    });

    it("enter on focused row triggers its onCancel", async () => {
      const user = userEvent.setup();
      const onCancel1 = vi.fn();
      const onCancel2 = vi.fn();
      renderPicker([
        makeRunner({ onCancel: onCancel1, tabId: "t1", tabTitle: "First" }),
        makeRunner({ onCancel: onCancel2, tabId: "t2", tabTitle: "Second" }),
      ]);
      await user.click(
        screen.getByRole("button", { name: /show 2 running queries/i })
      );
      await screen.findByRole("listbox");
      await user.keyboard("{ArrowDown}");
      await user.keyboard("{Enter}");
      expect(onCancel1).not.toHaveBeenCalled();
      expect(onCancel2).toHaveBeenCalledOnce();
    });
  });
});
