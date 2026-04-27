import type { Meta, StoryObj } from "@storybook/react-vite";

import { expect } from "storybook/test";

import { Badge } from "./badge";

const meta = {
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "secondary",
        "destructive",
        "outline",
        "ghost",
        "link",
      ],
    },
  },
  args: {
    children: "Badge",
  },
  component: Badge,
  title: "UI/Badge",
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    const badge = canvas.getByText("Badge");
    await expect(badge).toBeVisible();
  },
};

export const Secondary: Story = {
  args: { variant: "secondary" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Badge")).toBeVisible();
  },
};

export const Destructive: Story = {
  args: { variant: "destructive" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Badge")).toBeVisible();
  },
};

export const Outline: Story = {
  args: { variant: "outline" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Badge")).toBeVisible();
  },
};

export const Ghost: Story = {
  args: { variant: "ghost" },
};

export const Link: Story = {
  args: { variant: "link" },
};

export const AllVariants: Story = {
  play: async ({ canvas }) => {
    for (const text of [
      "Default",
      "Secondary",
      "Destructive",
      "Outline",
      "Ghost",
      "Link",
    ]) {
      await expect(canvas.getByText(text)).toBeVisible();
    }
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="ghost">Ghost</Badge>
      <Badge variant="link">Link</Badge>
    </div>
  ),
  tags: ["!autodocs"],
};
