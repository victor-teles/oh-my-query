import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import type { ChartConfig } from "./chart";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "./chart";

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

describe("chart", () => {
  it("bar Chart", () => {
    const screen = render(
      <ChartContainer className="h-64 w-full max-w-lg" config={barConfig}>
        <BarChart accessibilityLayer data={barData}>
          <CartesianGrid vertical={false} />
          <XAxis axisLine={false} dataKey="month" tickLine={false} />
          <YAxis axisLine={false} tickLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            dataKey="queries"
            fill="var(--color-queries)"
            isAnimationActive={false}
            radius={4}
          />
          <Bar
            dataKey="errors"
            fill="var(--color-errors)"
            isAnimationActive={false}
            radius={4}
          />
        </BarChart>
      </ChartContainer>
    );
    const chart = screen.container.querySelector("[data-slot='chart']");
    expect(chart).toBeTruthy();
    expect(screen.container).toMatchSnapshot();
  });

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

  it("line Chart", () => {
    const screen = render(
      <ChartContainer className="h-64 w-full max-w-lg" config={lineConfig}>
        <LineChart accessibilityLayer data={lineData}>
          <CartesianGrid vertical={false} />
          <XAxis axisLine={false} dataKey="time" tickLine={false} />
          <YAxis axisLine={false} tickLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line
            dataKey="latency"
            dot={false}
            isAnimationActive={false}
            stroke="var(--color-latency)"
            strokeWidth={2}
            type="monotone"
          />
        </LineChart>
      </ChartContainer>
    );
    const chart = screen.container.querySelector("[data-slot='chart']");
    expect(chart).toBeTruthy();
    expect(screen.container).toMatchSnapshot();
  });
});
