import { CARD_SPEC_VERSION } from "@conch/rpc";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";

import type { CardViewKind } from "@/lib/card-data";

import { kpi, revenue, signups } from "@/test/card-fixtures";

import { AskCard } from "./ask-card";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const renderRevenue = (view: CardViewKind = "line", onSelectView = vi.fn()) =>
  render(
    <div style={{ width: 760 }}>
      <AskCard
        onSelectView={onSelectView}
        result={revenue.result}
        spec={revenue.spec}
        view={view}
      />
    </div>
  );

describe.each([
  ["full motion", false],
  ["reduced motion", true],
])("askCard with %s", (_label, isReduced) => {
  it("shows the title, legend values, chart and insight", async () => {
    reduced.value = isReduced;
    const screen = renderRevenue();
    await expect
      .element(
        screen.getByRole("heading", {
          name: "Monthly recurring revenue by region",
        })
      )
      .toBeVisible();
    await expect
      .element(screen.getByText("Jan to Sep 2026 · $475k in September"))
      .toBeVisible();
    const legend = screen.getByRole("list", { name: "Latest values" });
    await expect.element(legend).toHaveTextContent("North America$258k");
    await expect.element(legend).toHaveTextContent("Asia Pacific$71k");
    await expect
      .element(
        screen.getByRole("img", {
          name: /Line chart: Monthly recurring revenue/,
        })
      )
      .toBeVisible();
    await expect
      .element(screen.getByText(/Asia Pacific more than doubled/))
      .toBeVisible();
  });

  it("switches views from the radio group", async () => {
    reduced.value = isReduced;
    const onSelectView = vi.fn();
    const screen = renderRevenue("line", onSelectView);
    await expect
      .element(screen.getByRole("radio", { name: "Line" }))
      .toHaveAttribute("aria-checked", "true");
    await screen.getByRole("radio", { name: "Table" }).click();
    expect(onSelectView).toHaveBeenCalledWith("table");
  });
});

describe("askCard views", () => {
  it("renders the table view with formatted cells", async () => {
    const screen = renderRevenue("table");
    const table = screen.getByRole("table");
    await expect.element(table).toBeVisible();
    await expect.element(table).toHaveTextContent("Jan 2026North America$180k");
  });

  it("moves between views with the arrow keys", async () => {
    const onSelectView = vi.fn();
    const screen = renderRevenue("line", onSelectView);
    await userEvent.click(screen.getByRole("radio", { name: "Line" }));
    await userEvent.keyboard("{ArrowRight}");
    expect(onSelectView).toHaveBeenLastCalledWith("table");
  });

  it("renders a stacked bar with one legend entry per series", async () => {
    const screen = render(
      <div style={{ width: 760 }}>
        <AskCard
          onSelectView={vi.fn()}
          result={signups.result}
          spec={signups.spec}
          view="bar"
        />
      </div>
    );
    const legend = screen.getByRole("list", { name: "Latest values" });
    await expect.element(legend).toHaveTextContent("Free534");
    await expect.element(legend).toHaveTextContent("Team33");
    await expect
      .poll(
        () =>
          screen.container.querySelectorAll(".recharts-bar-rectangle").length
      )
      .toBeGreaterThan(0);
  });

  it("draws an area chart when the spec asks for one", async () => {
    const view = { ...signups.spec.view, mark: "area" as const };
    const screen = render(
      <div style={{ width: 760 }}>
        <AskCard
          onSelectView={vi.fn()}
          result={signups.result}
          spec={{ ...signups.spec, view }}
          view="area"
        />
      </div>
    );
    await expect
      .element(screen.getByRole("radio", { name: "Area" }))
      .toBeVisible();
    await expect
      .poll(() => screen.container.querySelectorAll(".recharts-area").length)
      .toBe(4);
  });

  it("names categorical series without a misleading latest value", async () => {
    const spec = {
      formats: { revenue: { currency: "USD", kind: "currency" as const } },
      title: "Revenue by order status",
      version: CARD_SPEC_VERSION,
      view: {
        kind: "chart" as const,
        mark: "bar" as const,
        stacked: false,
        x: "status",
        y: ["revenue"],
      },
    };
    const result = {
      columns: [
        { name: "status", typeName: "TEXT" },
        { name: "revenue", typeName: "NUMERIC" },
      ],
      isTruncated: false,
      rowCount: 2,
      rows: [
        ["paid", "139.99"],
        ["refunded", "7.99"],
      ],
    };
    const screen = render(
      <div style={{ width: 760 }}>
        <AskCard
          onSelectView={vi.fn()}
          result={result}
          spec={spec}
          view="bar"
        />
      </div>
    );
    const legend = screen.getByRole("list", { name: "Series" });
    await expect.element(legend).toHaveTextContent("Revenue");
    expect(legend.element().textContent).not.toContain("$7.99");
  });

  it("renders a KPI with its delta", async () => {
    const screen = render(
      <AskCard
        onSelectView={vi.fn()}
        result={kpi.result}
        spec={kpi.spec}
        view="kpi"
      />
    );
    await expect
      .element(screen.getByTestId("kpi-value"))
      .toHaveTextContent("$475k");
    await expect.element(screen.getByText("MRR in September")).toBeVisible();
    await expect.element(screen.getByText(/\+54%/)).toBeVisible();
    await expect
      .element(screen.getByRole("radio", { name: "KPI" }))
      .toBeVisible();
  });

  it("renders a pie with a legend", async () => {
    const spec = {
      ...signups.spec,
      view: { kind: "pie" as const, label: "week", value: "free" },
    };
    const screen = render(
      <div style={{ width: 760 }}>
        <AskCard
          onSelectView={vi.fn()}
          result={signups.result}
          spec={spec}
          view="pie"
        />
      </div>
    );
    await expect
      .element(screen.getByRole("img", { name: /Pie chart/ }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("radio", { name: "Pie" }))
      .toBeVisible();
  });

  it("matches the populated line card snapshot", async () => {
    const screen = renderRevenue();
    await expect
      .element(screen.getByText(/Asia Pacific more than doubled/))
      .toBeVisible();
    expect(
      screen
        .getByRole("region", { name: "Monthly recurring revenue by region" })
        .element()
    ).toMatchSnapshot();
  });
});
