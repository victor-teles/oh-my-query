import type { ReactNode } from "react";

import { CARD_SPEC_VERSION } from "@oh-my-query/rpc";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";

import type { CardViewKind } from "@/lib/card-data";
import type { DrillSegment } from "@/lib/drill";
import type { CardSpec } from "@/lib/ipc";

import { revenue, signups } from "@/test/card-fixtures";

import type { DrillTarget } from "./drill-context";

import { AskCard } from "./ask-card";
import { DrillProvider } from "./drill-context";

const reduced = vi.hoisted(() => ({ value: true }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const groupedBars: CardSpec = {
  ...revenue.spec,
  view: {
    groupBy: "region",
    kind: "chart",
    mark: "bar",
    stacked: false,
    x: "month",
    y: ["mrr"],
  },
};
const statusPie: CardSpec = {
  formats: {},
  title: "Signups by plan",
  version: CARD_SPEC_VERSION,
  view: { kind: "pie", label: "week", value: "free" },
};

const targetOf = (hidden = false) => {
  const drill = vi.fn<(segment: DrillSegment) => void>();
  const target: DrillTarget = { drill, isHidden: () => hidden };
  return { drill, target };
};

const renderCard = (
  spec: CardSpec,
  view: CardViewKind,
  target: DrillTarget | null,
  result = revenue.result
) => {
  const card: ReactNode = (
    <AskCard onSelectView={vi.fn()} result={result} spec={spec} view={view} />
  );
  return render(
    <div style={{ width: 760 }}>
      {target ? <DrillProvider target={target}>{card}</DrillProvider> : card}
    </div>
  );
};

const marks = (selector: string) =>
  expect
    .poll(() => document.querySelectorAll(selector).length)
    .toBeGreaterThan(0);

// Recharts re-renders its marks while the pointer moves, which keeps
// Playwright's stability check waiting; the e2e covers a real click.
const press = (mark: Element) =>
  mark.dispatchEvent(new MouseEvent("click", { bubbles: true }));

const markAt = (selector: string, index = 0): Element => {
  const mark = document.querySelectorAll(selector).item(index);
  if (!mark) {
    throw new Error(`no ${selector} at ${index}`);
  }
  return mark;
};

describe("drilling into a card", () => {
  it("drills into a bar by its series and x value", async () => {
    const { drill, target } = targetOf();
    renderCard(groupedBars, "bar", target);
    await marks(".recharts-bar-rectangle path");
    press(markAt(".recharts-bar-rectangle path"));
    expect(drill).toHaveBeenCalledWith({
      filters: [
        { column: "region", value: "North America" },
        { column: "month", value: "2026-01-01" },
      ],
    });
  });

  it("dims the other bars of the hovered series", async () => {
    const { target } = targetOf();
    renderCard(groupedBars, "bar", target);
    await marks(".recharts-bar-rectangle path");
    const first = markAt(".recharts-bar-rectangle path");
    const second = markAt(".recharts-bar-rectangle path", 1);
    first.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    await expect.poll(() => second.getAttribute("fill-opacity")).toBe("0.5");
    expect(first.getAttribute("fill-opacity")).toBe("1");
  });

  it("drills into the x value under the pointer on a line chart", async () => {
    const { drill, target } = targetOf();
    const screen = renderCard(revenue.spec, "line", target);
    await marks(".recharts-line");
    await userEvent.click(screen.getByRole("img", { name: /Line chart/ }));
    expect(drill.mock.calls[0]?.[0].filters).toStrictEqual([
      { column: "month", value: expect.stringMatching(/^2026-0\d-01$/) },
    ]);
  });

  it("drills into a pie slice by its label", async () => {
    const { drill, target } = targetOf();
    renderCard(statusPie, "pie", target, signups.result);
    await marks(".recharts-pie-sector path");
    press(markAt(".recharts-pie-sector path"));
    expect(drill.mock.calls[0]?.[0].filters[0]?.column).toBe("week");
  });

  it("drills into a table row with a click or ↵", async () => {
    const { drill, target } = targetOf();
    const screen = renderCard(revenue.spec, "table", target);
    const row = screen.getByRole("row").nth(2);
    await expect.element(row).toHaveAttribute("tabindex", "0");
    row.element().focus();
    await userEvent.keyboard("{Enter}");
    expect(drill).toHaveBeenCalledWith({
      filters: [
        { column: "month", value: "2026-01-01" },
        { column: "region", value: "Europe" },
      ],
    });
  });

  it("leaves segments hidden by PII redaction alone", async () => {
    const { drill, target } = targetOf(true);
    const screen = renderCard(revenue.spec, "table", target);
    const row = screen.getByRole("row").nth(1);
    await expect
      .element(row)
      .toHaveAttribute("title", "Hidden by PII redaction");
    await row.click();
    expect(drill).not.toHaveBeenCalled();
  });
});

describe("cards outside the ask view", () => {
  it("stay inert without a drill provider", async () => {
    const screen = renderCard(groupedBars, "bar", null);
    await marks(".recharts-bar-rectangle path");
    expect(document.querySelector("[data-drill]")).toBeNull();
    await screen.rerender(
      <div style={{ width: 760 }}>
        <AskCard
          onSelectView={vi.fn()}
          result={revenue.result}
          spec={revenue.spec}
          view="table"
        />
      </div>
    );
    await expect
      .element(screen.getByRole("row").nth(1))
      .not.toHaveAttribute("tabindex");
  });
});
