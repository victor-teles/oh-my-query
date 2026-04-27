import type { Meta, StoryObj } from "@storybook/react-vite";

import { expect } from "storybook/test";

import { ScrollArea } from "./scroll-area";
import { Separator } from "./separator";

const meta = {
  component: ScrollArea,
  title: "UI/ScrollArea",
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

const tables = [
  "users",
  "orders",
  "products",
  "categories",
  "reviews",
  "payments",
  "shipments",
  "addresses",
  "sessions",
  "logs",
  "notifications",
  "preferences",
];

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Tables")).toBeVisible();
    await expect(canvas.getByText("users")).toBeVisible();
  },
  render: () => (
    <ScrollArea className="h-48 w-48 rounded-md border">
      <div className="p-3">
        <h4 className="mb-3 text-sm font-medium">Tables</h4>
        {tables.map((table) => (
          <div key={table}>
            <div className="py-1.5 text-xs">{table}</div>
            <Separator />
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <ScrollArea className="w-72 rounded-md border">
      <div className="flex gap-3 p-3">
        {tables.map((table) => (
          <div
            key={table}
            className="flex h-16 w-24 shrink-0 items-center justify-center rounded-md border text-xs"
          >
            {table}
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};
