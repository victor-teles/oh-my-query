import type { Meta, StoryObj } from "@storybook/react-vite";

import { expect } from "storybook/test";

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "./avatar";

const meta = {
  argTypes: {
    size: {
      control: "select",
      options: ["default", "sm", "lg"],
    },
  },
  component: Avatar,
  title: "UI/Avatar",
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithImage: Story = {
  play: async ({ canvasElement }) => {
    const avatar = canvasElement.querySelector("[data-slot='avatar']");
    await expect(avatar).toBeTruthy();
  },
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
      <AvatarFallback>CN</AvatarFallback>
    </Avatar>
  ),
};

export const Fallback: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("VM")).toBeVisible();
  },
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage src="/broken-image.png" alt="User" />
      <AvatarFallback>VM</AvatarFallback>
    </Avatar>
  ),
};

export const Small: Story = {
  args: { size: "sm" },
  render: (args) => (
    <Avatar {...args}>
      <AvatarFallback>SM</AvatarFallback>
    </Avatar>
  ),
};

export const Large: Story = {
  args: { size: "lg" },
  render: (args) => (
    <Avatar {...args}>
      <AvatarFallback>LG</AvatarFallback>
    </Avatar>
  ),
};

export const WithBadge: Story = {
  play: async ({ canvasElement }) => {
    const badge = canvasElement.querySelector("[data-slot='avatar-badge']");
    await expect(badge).toBeTruthy();
  },
  render: (args) => (
    <Avatar {...args}>
      <AvatarFallback>VM</AvatarFallback>
      <AvatarBadge />
    </Avatar>
  ),
};

export const Group: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("A")).toBeVisible();
    await expect(canvas.getByText("+3")).toBeVisible();
  },
  render: () => (
    <AvatarGroup>
      <Avatar>
        <AvatarFallback>A</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>B</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>C</AvatarFallback>
      </Avatar>
      <AvatarGroupCount>+3</AvatarGroupCount>
    </AvatarGroup>
  ),
};
