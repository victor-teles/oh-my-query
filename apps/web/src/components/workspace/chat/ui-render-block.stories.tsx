import type { Meta, StoryObj } from "@storybook/react-vite";

import { expect, userEvent } from "storybook/test";

import { UIRenderBlock } from "./ui-render-block";

const meta = {
  component: UIRenderBlock,
  parameters: { layout: "padded" },
  title: "Workspace/Chat/UIRenderBlock",
} satisfies Meta<typeof UIRenderBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

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
          { month: "Jan", queries: 186 },
          { month: "Feb", queries: 305 },
          { month: "Mar", queries: 237 },
          { month: "Apr", queries: 173 },
          { month: "May", queries: 409 },
          { month: "Jun", queries: 214 },
        ],
        description: "Monthly query volume for the last six months.",
        series: [{ key: "queries", label: "Queries" }],
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
        series: [{ color: "var(--chart-2)", key: "latency", label: "p95 ms" }],
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

export const ValidCard: Story = {
  args: { code: validCardSpec },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Status")).toBeVisible();
    await expect(canvas.getByText("Database is healthy.")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Show source" })
    ).toBeInTheDocument();
  },
};

export const InlineBadge: Story = {
  args: { code: inlineBadgeSpec },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("12 rows")).toBeVisible();
  },
};

export const ToggleViewSpec: Story = {
  args: { code: validCardSpec },
  play: async ({ canvas }) => {
    const toggle = canvas.getByRole("button", { name: "Show source" });
    await userEvent.click(toggle);
    await expect(canvas.getByText(/"root": "root"/)).toBeVisible();
  },
};

export const MissingChild: Story = {
  args: { code: missingChildSpec },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Couldn't render this UI")).toBeVisible();
    const reveal = canvas.getByRole("button", { name: "Show source" });
    await userEvent.click(reveal);
    await expect(canvas.getByText(/Broken card/)).toBeVisible();
  },
};

export const UnknownComponent: Story = {
  args: { code: unknownComponentSpec },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Couldn't render this UI")).toBeVisible();
    await expect(canvas.getByText(/Unknown component "Button"/)).toBeVisible();
  },
};

export const PartialStream: Story = {
  args: { code: partiallyStreamedSpec },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText(/error/i)).toBeNull();
  },
};

export const ChartBarExample: Story = {
  args: { code: chartBarSpec },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Query volume")).toBeVisible();
    await expect(
      canvas.getByText("Monthly query volume for the last six months.")
    ).toBeVisible();
  },
};

export const ChartLineExample: Story = {
  args: { code: chartLineSpec },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Latency over the day")).toBeVisible();
  },
};

export const ChartPieExample: Story = {
  args: { code: chartPieSpec },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Request outcomes")).toBeVisible();
    await expect(canvas.getByText("ok")).toBeVisible();
  },
};

export const ChartKpiExample: Story = {
  args: { code: chartKpiSpec },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Active users")).toBeVisible();
    await expect(canvas.getByText("1,248")).toBeVisible();
    await expect(canvas.getByText(/vs last week/)).toBeVisible();
  },
};

export const ChartEmpty: Story = {
  args: { code: chartEmptySpec },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No data yet")).toBeVisible();
    await expect(canvas.getByText("No data to visualize")).toBeVisible();
  },
};

export const ChartTruncatedOverLimit: Story = {
  args: { code: chartTruncatedSpec },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Large series")).toBeVisible();
    await expect(
      canvas.getByText(/Showing first 500 of 750 points/)
    ).toBeVisible();
  },
};

export const ChartNonNumericSeries: Story = {
  args: { code: chartNonNumericSpec },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Bad series")).toBeVisible();
    await expect(
      canvas.getByText("No numeric series found in data")
    ).toBeVisible();
  },
};

export const KeyboardActions: Story = {
  args: { code: validCardSpec },
  play: async ({ canvas, step }) => {
    const sourceButton = canvas.getByRole("button", { name: "Show source" });
    await step("focus the card via keyboard", () => {
      sourceButton.focus();
    });
    await step("press s to toggle to source view", async () => {
      await userEvent.keyboard("s");
      await expect(canvas.getByText(/"root": "root"/)).toBeVisible();
    });
    await step("press s again to return to preview", async () => {
      await userEvent.keyboard("s");
      await expect(canvas.getByText("Database is healthy.")).toBeVisible();
    });
  },
};
