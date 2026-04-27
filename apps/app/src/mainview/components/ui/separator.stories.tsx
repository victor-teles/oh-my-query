import type { Meta, StoryObj } from "@storybook/react-vite";

import { expect } from "storybook/test";

import { Separator } from "./separator";

const meta = {
  component: Separator,
  title: "UI/Separator",
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  play: async ({ canvas }) => {
    const separator = canvas.getByRole("separator");
    await expect(separator).toBeVisible();
    await expect(separator).toHaveAttribute("data-orientation", "horizontal");
  },
};

export const Vertical: Story = {
  args: { orientation: "vertical" },
  decorators: [
    (Story) => (
      <div className="flex h-8 items-center">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvas }) => {
    const separator = canvas.getByRole("separator");
    await expect(separator).toBeVisible();
    await expect(separator).toHaveAttribute("data-orientation", "vertical");
  },
};

export const InContext: Story = {
  play: async ({ canvas }) => {
    const separators = canvas.getAllByRole("separator");
    await expect(separators).toHaveLength(3);
    await expect(canvas.getByText("Docs")).toBeVisible();
    await expect(canvas.getByText("Source")).toBeVisible();
    await expect(canvas.getByText("Settings")).toBeVisible();
  },
  render: () => (
    <div className="space-y-1">
      <div className="text-sm font-medium">oh-my-query</div>
      <p className="text-xs text-muted-foreground">
        A desktop app for querying databases.
      </p>
      <Separator />
      <div className="flex h-5 items-center gap-4 text-xs">
        <span>Docs</span>
        <Separator orientation="vertical" />
        <span>Source</span>
        <Separator orientation="vertical" />
        <span>Settings</span>
      </div>
    </div>
  ),
  tags: ["!autodocs"],
};
