import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";

import { UIRenderBlock } from "./ui-render-block";

const DarkFrame = ({ children }: { children: ReactNode }) => (
  <div className="dark bg-background p-4 text-foreground">{children}</div>
);

const validCardSpec = JSON.stringify(
  {
    elements: {
      body: { props: { text: "Database is healthy." }, type: "Text" },
      heading: {
        props: { level: 3, text: "Status" },
        type: "Heading",
      },
      root: {
        children: ["stack"],
        props: {
          description: "All systems operational.",
          title: "System status",
        },
        type: "Card",
      },
      stack: {
        children: ["heading", "body"],
        props: { direction: "vertical", gap: 2 },
        type: "Stack",
      },
    },
    root: "root",
  },
  null,
  2
);

const inlineBadgeSpec = JSON.stringify({
  elements: {
    badge: { props: { text: "12 rows", variant: "secondary" }, type: "Badge" },
  },
  root: "badge",
});

const missingChildSpec = JSON.stringify({
  elements: {
    main: {
      children: ["ghost"],
      props: { title: "Broken card" },
      type: "Card",
    },
  },
  root: "main",
});

const unknownComponentSpec = JSON.stringify({
  elements: {
    main: { props: { label: "Click me" }, type: "Button" },
  },
  root: "main",
});

const partiallyStreamedSpec = '{"root": "main", "elem';

const chartBarSpec = JSON.stringify({
  elements: {
    root: {
      props: {
        data: [
          { errors: 12, month: "Jan", queries: 186 },
          { errors: 8, month: "Feb", queries: 305 },
          { errors: 15, month: "Mar", queries: 237 },
          { errors: 5, month: "Apr", queries: 173 },
          { errors: 22, month: "May", queries: 409 },
          { errors: 9, month: "Jun", queries: 214 },
        ],
        description: "Monthly query volume and errors for the last six months.",
        series: [
          { key: "queries", label: "Queries" },
          { key: "errors", label: "Errors" },
        ],
        title: "Query volume",
        xKey: "month",
      },
      type: "ChartBar",
    },
  },
  root: "root",
});

const chartLineSpec = JSON.stringify({
  elements: {
    root: {
      props: {
        data: [
          { latency: 45, time: "00:00" },
          { latency: 32, time: "04:00" },
          { latency: 67, time: "08:00" },
          { latency: 120, time: "12:00" },
          { latency: 85, time: "16:00" },
          { latency: 52, time: "20:00" },
        ],
        series: [{ key: "latency", label: "p95 ms" }],
        smooth: true,
        title: "Latency over the day",
        xKey: "time",
      },
      type: "ChartLine",
    },
  },
  root: "root",
});

const chartPieSpec = JSON.stringify({
  elements: {
    root: {
      props: {
        data: [
          { count: 42, status: "ok" },
          { count: 8, status: "error" },
          { count: 3, status: "timeout" },
        ],
        donut: true,
        nameKey: "status",
        title: "Request outcomes",
        valueKey: "count",
      },
      type: "ChartPie",
    },
  },
  root: "root",
});

const chartKpiSpec = JSON.stringify({
  elements: {
    root: {
      props: {
        delta: 128,
        deltaFormat: "number",
        deltaLabel: "vs last week",
        description: "Distinct users who ran at least one query.",
        format: "number",
        label: "Active users",
        value: 1248,
      },
      type: "ChartKpi",
    },
  },
  root: "root",
});

const chartKpiNegativeSpec = JSON.stringify({
  elements: {
    root: {
      props: {
        currency: "USD",
        delta: -0.04,
        deltaFormat: "percent",
        deltaLabel: "vs yesterday",
        description: "Revenue trend for the current billing window.",
        format: "currency",
        label: "Revenue today",
        value: 48_250,
      },
      type: "ChartKpi",
    },
  },
  root: "root",
});

const chartEmptySpec = JSON.stringify({
  elements: {
    root: {
      props: {
        data: [],
        series: [{ key: "queries", label: "Queries" }],
        title: "No data yet",
        xKey: "month",
      },
      type: "ChartBar",
    },
  },
  root: "root",
});

const chartTruncatedSpec = (() => {
  const data = Array.from({ length: 750 }, (_, i) => ({
    step: i,
    value: Math.sin(i / 20) * 100 + 100,
  }));
  return JSON.stringify({
    elements: {
      root: {
        props: {
          data,
          description: "Simulated dataset above the 500-point cap.",
          series: [{ key: "value", label: "Signal" }],
          title: "Large series",
          xKey: "step",
        },
        type: "ChartLine",
      },
    },
    root: "root",
  });
})();

const chartNonNumericSpec = JSON.stringify({
  elements: {
    root: {
      props: {
        data: [
          { label: "A", raw: "not-a-number" },
          { label: "B", raw: "also-string" },
        ],
        series: [{ key: "raw", label: "Raw" }],
        title: "Bad series",
        xKey: "label",
      },
      type: "ChartBar",
    },
  },
  root: "root",
});

describe("ui-render-block", () => {
  it("validCard", async () => {
    const screen = render(<UIRenderBlock code={validCardSpec} />);
    await expect
      .element(screen.getByRole("heading", { name: "Status" }))
      .toBeVisible();
    await expect
      .element(screen.getByText("Database is healthy."))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Show source" }))
      .toBeInTheDocument();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("inlineBadge", async () => {
    const screen = render(<UIRenderBlock code={inlineBadgeSpec} />);
    await expect.element(screen.getByText("12 rows")).toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("toggleViewSpec", async () => {
    const screen = render(<UIRenderBlock code={validCardSpec} />);
    const toggle = screen.getByRole("button", { name: "Show source" });
    await toggle.click();
    await expect.element(screen.getByText(/"root": "root"/)).toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("missingChild", async () => {
    const screen = render(<UIRenderBlock code={missingChildSpec} />);
    await expect
      .element(screen.getByText("Couldn't render this UI"))
      .toBeVisible();
    const reveal = screen.getByRole("button", { name: "Show source" });
    await reveal.click();
    await expect.element(screen.getByText(/Broken card/)).toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("unknownComponent", async () => {
    const screen = render(<UIRenderBlock code={unknownComponentSpec} />);
    await expect
      .element(screen.getByText("Couldn't render this UI"))
      .toBeVisible();
    await expect
      .element(screen.getByText(/Unknown component "Button"/))
      .toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("partialStream", async () => {
    const screen = render(<UIRenderBlock code={partiallyStreamedSpec} />);
    expect(screen.container.textContent).not.toMatch(/error/i);
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("chartBarExample", async () => {
    const screen = render(<UIRenderBlock code={chartBarSpec} />);
    await expect
      .element(screen.getByText("Query volume", { exact: true }))
      .toBeVisible();
    await expect
      .element(
        screen.getByText(
          "Monthly query volume and errors for the last six months."
        )
      )
      .toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("chartBarDark", async () => {
    const screen = render(
      <DarkFrame>
        <UIRenderBlock code={chartBarSpec} />
      </DarkFrame>
    );
    await expect
      .element(screen.getByText("Query volume", { exact: true }))
      .toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("chartLineExample", async () => {
    const screen = render(<UIRenderBlock code={chartLineSpec} />);
    await expect
      .element(screen.getByText("Latency over the day"))
      .toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("chartLineDark", async () => {
    const screen = render(
      <DarkFrame>
        <UIRenderBlock code={chartLineSpec} />
      </DarkFrame>
    );
    await expect
      .element(screen.getByText("Latency over the day"))
      .toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("chartPieExample", async () => {
    const screen = render(<UIRenderBlock code={chartPieSpec} />);
    await expect.element(screen.getByText("Request outcomes")).toBeVisible();
    await expect.element(screen.getByText("ok")).toBeVisible();
    await expect.element(screen.getByText("Total")).toBeVisible();
    await expect.element(screen.getByText("53")).toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("chartPieDark", async () => {
    const screen = render(
      <DarkFrame>
        <UIRenderBlock code={chartPieSpec} />
      </DarkFrame>
    );
    await expect.element(screen.getByText("Request outcomes")).toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("chartKpiExample", async () => {
    const screen = render(<UIRenderBlock code={chartKpiSpec} />);
    await expect.element(screen.getByText("Active users")).toBeVisible();
    await expect.element(screen.getByText("1,248")).toBeVisible();
    await expect.element(screen.getByText(/vs last week/)).toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("chartKpiNegative", async () => {
    const screen = render(<UIRenderBlock code={chartKpiNegativeSpec} />);
    await expect.element(screen.getByText("Revenue today")).toBeVisible();
    await expect.element(screen.getByText(/-4\.0%/)).toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("chartKpiDark", async () => {
    const screen = render(
      <DarkFrame>
        <UIRenderBlock code={chartKpiSpec} />
      </DarkFrame>
    );
    await expect.element(screen.getByText("Active users")).toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("chartEmpty", async () => {
    const screen = render(<UIRenderBlock code={chartEmptySpec} />);
    await expect.element(screen.getByText("No data yet")).toBeVisible();
    await expect.element(screen.getByText(/run the query above/)).toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("chartTruncatedOverLimit", async () => {
    const screen = render(<UIRenderBlock code={chartTruncatedSpec} />);
    await expect.element(screen.getByText("Large series")).toBeVisible();
    await expect
      .element(screen.getByText(/Downsampled to 500 of 750 points/))
      .toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("chartNonNumericSeries", async () => {
    const screen = render(<UIRenderBlock code={chartNonNumericSpec} />);
    await expect.element(screen.getByText("Bad series")).toBeVisible();
    await expect
      .element(screen.getByText(/None of the selected columns are numeric/))
      .toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("keyboardActions", async () => {
    const screen = render(<UIRenderBlock code={validCardSpec} />);
    const sourceButton = screen.getByRole("button", { name: "Show source" });
    (sourceButton.element() as HTMLElement).focus();
    await userEvent.keyboard("s");
    await expect.element(screen.getByText(/"root": "root"/)).toBeVisible();
    await userEvent.keyboard("s");
    await expect
      .element(screen.getByText("Database is healthy."))
      .toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });
});
