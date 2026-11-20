import { CrosshairIcon } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";

import type { DrillItem } from "./drill-list";

import { DrillList } from "./drill-list";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const item = (label: string, disabled = false): DrillItem => ({
  disabled,
  icon: CrosshairIcon,
  id: label,
  label,
  segment: { filters: [{ column: "region", value: label }] },
  tone: "default",
});

const ITEMS = [
  item("Europe"),
  item("Hidden by PII redaction", true),
  item("Asia"),
];

describe.each([
  ["full motion", false],
  ["reduced motion", true],
])("drillList with %s", (_label, isReduced) => {
  it("moves with the arrows, picks with ↵ and skips hidden segments", async () => {
    reduced.value = isReduced;
    const onPick = vi.fn();
    const screen = render(
      <div className="relative h-96">
        <DrillList items={ITEMS} onClose={vi.fn()} onPick={onPick} />
      </div>
    );
    const list = screen.getByRole("menu", { name: "Drill into…" });
    await expect.element(list).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onPick).not.toHaveBeenCalled();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onPick).toHaveBeenCalledWith(ITEMS[2]);
  });

  it("closes on Escape and on ⌘D", async () => {
    reduced.value = isReduced;
    const onClose = vi.fn();
    render(<DrillList items={ITEMS} onClose={onClose} onPick={vi.fn()} />);
    await userEvent.keyboard("{Escape}");
    await userEvent.keyboard("{Meta>}d{/Meta}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("drillList states", () => {
  it("matches the open list snapshot", async () => {
    reduced.value = true;
    const screen = render(
      <DrillList items={ITEMS} onClose={vi.fn()} onPick={vi.fn()} />
    );
    const list = screen.getByRole("menu", { name: "Drill into…" });
    await expect.element(list).toBeVisible();
    expect(list.element()).toMatchSnapshot();
  });
});
