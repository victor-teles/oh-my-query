import type { Meta, StoryObj } from "@storybook/react-vite";

import { expect } from "storybook/test";

import { Skeleton } from "./skeleton";

const meta = {
  component: Skeleton,
  title: "UI/Skeleton",
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    className: "h-4 w-48",
  },
  play: async ({ canvasElement }) => {
    const skeleton = canvasElement.querySelector("[data-slot='skeleton']");
    await expect(skeleton).toBeTruthy();
  },
};

export const Circle: Story = {
  args: {
    className: "size-10 rounded-full",
  },
};

export const CardPlaceholder: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Skeleton className="size-10 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  ),
  tags: ["!autodocs"],
};
