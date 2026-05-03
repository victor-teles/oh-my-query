import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

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
      const screen = renderPicker([makeRunner({ tabTitle: "Top users" })]);
      expect(
        screen.getByRole("button", { name: /show running query/i })
      ).toBeInTheDocument();
      expect(page.getByRole("listbox").query()).toBeNull();
    });

    it("shows +N-1 chip when 2 or more runners", () => {
      const screen = renderPicker([
        makeRunner({ tabId: "t1", tabTitle: "First" }),
        makeRunner({ tabId: "t2", tabTitle: "Second" }),
        makeRunner({ tabId: "t3", tabTitle: "Third" }),
      ]);
      expect(screen.getByText("+2", { exact: true })).toBeInTheDocument();
    });

    it("does not show count chip with one runner", () => {
      const screen = renderPicker([makeRunner()]);
      expect(screen.getByText(/^\+\d+$/).query()).toBeNull();
    });
  });

  describe("opening", () => {
    it("opens picker on trigger click and lists rows", async () => {
      const screen = renderPicker([
        makeRunner({ tabId: "t1", tabTitle: "First" }),
        makeRunner({ tabId: "t2", tabTitle: "Second" }),
      ]);
      await screen
        .getByRole("button", { name: /show 2 running queries/i })
        .click();
      const listbox = page.getByRole("listbox", { name: /running queries/i });
      await expect.element(listbox).toBeInTheDocument();
      const options = page.getByRole("option").elements();
      expect(options).toHaveLength(2);
      expect(page.getByText("First")).toBeInTheDocument();
      expect(page.getByText("Second")).toBeInTheDocument();
    });

    it("opens picker even with single runner (consistent UX)", async () => {
      const screen = renderPicker([makeRunner({ tabTitle: "Solo" })]);
      await screen.getByRole("button", { name: /show running query/i }).click();
      await expect.element(page.getByRole("listbox")).toBeInTheDocument();
      const options = page.getByRole("option").elements();
      expect(options).toHaveLength(1);
      expect(page.getByText("Solo")).toBeInTheDocument();
    });
  });

  describe("cancellation", () => {
    it("clicking row's cancel button calls only that runner's onCancel", async () => {
      const onCancel1 = vi.fn();
      const onCancel2 = vi.fn();
      const onCancel3 = vi.fn();
      const screen = renderPicker([
        makeRunner({ onCancel: onCancel1, tabId: "t1", tabTitle: "First" }),
        makeRunner({ onCancel: onCancel2, tabId: "t2", tabTitle: "Second" }),
        makeRunner({ onCancel: onCancel3, tabId: "t3", tabTitle: "Third" }),
      ]);
      await screen
        .getByRole("button", { name: /show 3 running queries/i })
        .click();
      await page.getByRole("button", { name: /cancel second/i }).click();
      expect(onCancel1).not.toHaveBeenCalled();
      expect(onCancel2).toHaveBeenCalledOnce();
      expect(onCancel3).not.toHaveBeenCalled();
    });

    it("cancel all calls every onCancel exactly once", async () => {
      const onCancel1 = vi.fn();
      const onCancel2 = vi.fn();
      const onCancel3 = vi.fn();
      const onCancelAll = vi.fn(() => {
        onCancel1();
        onCancel2();
        onCancel3();
      });
      const screen = renderPicker(
        [
          makeRunner({ onCancel: onCancel1, tabId: "t1", tabTitle: "First" }),
          makeRunner({ onCancel: onCancel2, tabId: "t2", tabTitle: "Second" }),
          makeRunner({ onCancel: onCancel3, tabId: "t3", tabTitle: "Third" }),
        ],
        { onCancelAll }
      );
      await screen
        .getByRole("button", { name: /show 3 running queries/i })
        .click();
      await page.getByRole("button", { name: /cancel all/i }).click();
      expect(onCancelAll).toHaveBeenCalledOnce();
      expect(onCancel1).toHaveBeenCalledOnce();
      expect(onCancel2).toHaveBeenCalledOnce();
      expect(onCancel3).toHaveBeenCalledOnce();
    });

    it("cancel all footer is absent for single runner", async () => {
      const screen = renderPicker([makeRunner()]);
      await screen.getByRole("button", { name: /show running query/i }).click();
      await expect.element(page.getByRole("listbox")).toBeInTheDocument();
      expect(
        page.getByRole("button", { name: /cancel all/i }).query()
      ).toBeNull();
    });
  });

  describe("dismissal", () => {
    it("esc key closes picker without calling any onCancel", async () => {
      const onCancel = vi.fn();
      const onCancelAll = vi.fn();
      const screen = renderPicker(
        [
          makeRunner({ onCancel, tabId: "t1", tabTitle: "First" }),
          makeRunner({ tabId: "t2", tabTitle: "Second" }),
        ],
        { onCancelAll }
      );
      await screen
        .getByRole("button", { name: /show 2 running queries/i })
        .click();
      await expect.element(page.getByRole("listbox")).toBeInTheDocument();
      await userEvent.keyboard("{Escape}");
      await expect.poll(() => page.getByRole("listbox").query()).toBeNull();
      expect(onCancel).not.toHaveBeenCalled();
      expect(onCancelAll).not.toHaveBeenCalled();
    });
  });

  describe("dynamic runners", () => {
    it("auto-closes when runners drain to zero", async () => {
      const screen = renderPicker([
        makeRunner({ tabId: "t1", tabTitle: "First" }),
        makeRunner({ tabId: "t2", tabTitle: "Second" }),
      ]);
      await screen
        .getByRole("button", { name: /show 2 running queries/i })
        .click();
      await expect.element(page.getByRole("listbox")).toBeInTheDocument();

      screen.rerender(
        <IslandRunningQueriesPicker
          headlineTabId=""
          onCancelAll={vi.fn()}
          runners={[]}
        />
      );

      await expect.poll(() => page.getByRole("listbox").query()).toBeNull();
    });

    it("renders nothing when runners is empty (degenerate guard)", () => {
      const screen = renderPicker([]);
      expect(screen.container.firstChild).toBeNull();
    });
  });

  describe("keyboard navigation", () => {
    it("arrowDown moves focus to next row", async () => {
      const screen = renderPicker([
        makeRunner({ tabId: "t1", tabTitle: "First" }),
        makeRunner({ tabId: "t2", tabTitle: "Second" }),
        makeRunner({ tabId: "t3", tabTitle: "Third" }),
      ]);
      await screen
        .getByRole("button", { name: /show 3 running queries/i })
        .click();
      await expect.element(page.getByRole("listbox")).toBeInTheDocument();
      const options = page.getByRole("option").elements();
      await expect
        .poll(() => options[0]?.getAttribute("aria-selected"))
        .toBe("true");
      await userEvent.keyboard("{ArrowDown}");
      await expect
        .poll(() => options[1]?.getAttribute("aria-selected"))
        .toBe("true");
    });

    it("enter on focused row triggers its onCancel", async () => {
      const onCancel1 = vi.fn();
      const onCancel2 = vi.fn();
      const screen = renderPicker([
        makeRunner({ onCancel: onCancel1, tabId: "t1", tabTitle: "First" }),
        makeRunner({ onCancel: onCancel2, tabId: "t2", tabTitle: "Second" }),
      ]);
      await screen
        .getByRole("button", { name: /show 2 running queries/i })
        .click();
      await expect.element(page.getByRole("listbox")).toBeInTheDocument();
      await userEvent.keyboard("{ArrowDown}");
      await userEvent.keyboard("{Enter}");
      expect(onCancel1).not.toHaveBeenCalled();
      expect(onCancel2).toHaveBeenCalledOnce();
    });
  });
});
