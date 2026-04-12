import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { expect } from "storybook/test";

import type { ChartConfig } from "./chart";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "./chart";

const meta = {
  component: ChartContainer,
  title: "UI/Chart",
} satisfies Meta<typeof ChartContainer>;

export default meta;
type Story = StoryObj<typeof meta>;

const barData = [
  { errors: 12, month: "Jan", queries: 186 },
  { errors: 8, month: "Feb", queries: 305 },
  { errors: 15, month: "Mar", queries: 237 },
  { errors: 5, month: "Apr", queries: 173 },
  { errors: 22, month: "May", queries: 409 },
  { errors: 9, month: "Jun", queries: 214 },
];

const barConfig = {
  errors: {
    color: "oklch(0.65 0.2 25)",
    label: "Errors",
  },
  queries: {
    color: "oklch(0.7 0.15 160)",
    label: "Queries",
  },
} satisfies ChartConfig;

export const BarChartStory: Story = {
  name: "Bar Chart",
  play: async ({ canvasElement }) => {
    const chart = canvasElement.querySelector("[data-slot='chart']");
    await expect(chart).toBeTruthy();
  },
  render: () => (
    <ChartContainer config={barConfig} className="h-64 w-full max-w-lg">
      <BarChart data={barData} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="queries" fill="var(--color-queries)" radius={4} />
        <Bar dataKey="errors" fill="var(--color-errors)" radius={4} />
      </BarChart>
    </ChartContainer>
  ),
};

const lineData = [
  { latency: 45, time: "00:00" },
  { latency: 32, time: "04:00" },
  { latency: 67, time: "08:00" },
  { latency: 120, time: "12:00" },
  { latency: 85, time: "16:00" },
  { latency: 52, time: "20:00" },
];

const lineConfig = {
  latency: {
    color: "oklch(0.75 0.12 250)",
    label: "Latency (ms)",
  },
} satisfies ChartConfig;

export const LineChartStory: Story = {
  name: "Line Chart",
  play: async ({ canvasElement }) => {
    const chart = canvasElement.querySelector("[data-slot='chart']");
    await expect(chart).toBeTruthy();
  },
  render: () => (
    <ChartContainer config={lineConfig} className="h-64 w-full max-w-lg">
      <LineChart data={lineData} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="time" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          type="monotone"
          dataKey="latency"
          stroke="var(--color-latency)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  ),
};
