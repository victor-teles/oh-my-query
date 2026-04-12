import type { Meta, StoryObj } from "@storybook/react-vite";

import { expect } from "storybook/test";

import { Spinner } from "./spinner";

const meta = {
  component: Spinner,
  title: "UI/Spinner",
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    const spinner = canvas.getByRole("status");
    await expect(spinner).toBeVisible();
    await expect(spinner).toHaveAttribute("aria-label", "Loading");
  },
};

export const Large: Story = {
  args: { className: "size-8" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toBeVisible();
  },
};

export const Small: Story = {
  args: { className: "size-3" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toBeVisible();
  },
};
