import type { Meta, StoryObj } from "@storybook/react-vite";

import { expect } from "storybook/test";

import { Kbd, KbdGroup } from "./kbd";

const meta = {
  args: {
    children: "⌘",
  },
  component: Kbd,
  title: "UI/Kbd",
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    const kbd = canvas.getByText("⌘");
    await expect(kbd).toBeVisible();
    await expect(kbd.tagName).toBe("KBD");
  },
};

export const WithText: Story = {
  args: { children: "Enter" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Enter")).toBeVisible();
  },
};

export const Group: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("⌘")).toBeVisible();
    await expect(canvas.getByText("K")).toBeVisible();
  },
  render: () => (
    <KbdGroup>
      <Kbd>⌘</Kbd>
      <Kbd>K</Kbd>
    </KbdGroup>
  ),
};

export const CommonShortcuts: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Save")).toBeVisible();
    await expect(canvas.getByText("Run query")).toBeVisible();
    await expect(canvas.getByText("Command palette")).toBeVisible();
    await expect(canvas.getByText("S")).toBeVisible();
    await expect(canvas.getByText("↵")).toBeVisible();
  },
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        Save
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>S</Kbd>
        </KbdGroup>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        Run query
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>↵</Kbd>
        </KbdGroup>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        Command palette
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </div>
    </div>
  ),
  tags: ["!autodocs"],
};
