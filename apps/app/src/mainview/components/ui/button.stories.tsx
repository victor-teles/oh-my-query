import type { Meta, StoryObj } from "@storybook/react-vite";

import { ArchiveIcon, PlusIcon, TrashIcon } from "lucide-react";
import { expect, fn, userEvent } from "storybook/test";

import { Button } from "./button";

const meta = {
  argTypes: {
    size: {
      control: "select",
      options: [
        "default",
        "sm",
        "xs",
        "lg",
        "icon",
        "icon-sm",
        "icon-lg",
        "icon-xs",
      ],
    },
    variant: {
      control: "select",
      options: [
        "default",
        "secondary",
        "destructive",
        "ghost",
        "outline",
        "link",
        "toolbar",
      ],
    },
  },
  args: {
    children: "Button",
    onClick: fn(),
  },
  component: Button,
  title: "UI/Button",
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvas }) => {
    const button = canvas.getByRole("button", { name: "Button" });
    await expect(button).toBeVisible();
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

export const Secondary: Story = {
  args: { variant: "secondary" },
  play: async ({ args, canvas }) => {
    const button = canvas.getByRole("button", { name: "Button" });
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

export const Destructive: Story = {
  args: { children: "Delete", variant: "destructive" },
  play: async ({ args, canvas }) => {
    const button = canvas.getByRole("button", { name: "Delete" });
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

export const Ghost: Story = {
  args: { variant: "ghost" },
  play: async ({ args, canvas }) => {
    const button = canvas.getByRole("button", { name: "Button" });
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

export const Outline: Story = {
  args: { variant: "outline" },
  play: async ({ args, canvas }) => {
    const button = canvas.getByRole("button", { name: "Button" });
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

export const Link: Story = {
  args: { variant: "link" },
  play: async ({ args, canvas }) => {
    const button = canvas.getByRole("button", { name: "Button" });
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

export const Toolbar: Story = {
  args: { variant: "toolbar" },
  play: async ({ args, canvas }) => {
    const button = canvas.getByRole("button", { name: "Button" });
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

export const Small: Story = {
  args: { size: "sm" },
};

export const ExtraSmall: Story = {
  args: { size: "xs" },
};

export const Large: Story = {
  args: { size: "lg" },
};

export const Icon: Story = {
  args: {
    "aria-label": "Add",
    children: <PlusIcon />,
    size: "icon",
  },
  play: async ({ args, canvas }) => {
    const button = canvas.getByRole("button", { name: "Add" });
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

export const IconSmall: Story = {
  args: {
    "aria-label": "Add",
    children: <PlusIcon />,
    size: "icon-sm",
  },
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <ArchiveIcon data-icon="inline-start" />
        Archive
      </>
    ),
  },
  play: async ({ args, canvas }) => {
    const button = canvas.getByRole("button", { name: "Archive" });
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

export const DestructiveWithIcon: Story = {
  args: {
    children: (
      <>
        <TrashIcon data-icon="inline-start" />
        Delete
      </>
    ),
    variant: "destructive",
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas }) => {
    const button = canvas.getByRole("button", { name: "Button" });
    await expect(button).toBeDisabled();
  },
};

export const AllVariants: Story = {
  play: async ({ canvas }) => {
    for (const name of [
      "Default",
      "Secondary",
      "Destructive",
      "Ghost",
      "Outline",
      "Link",
      "Toolbar",
    ]) {
      await expect(canvas.getByRole("button", { name })).toBeVisible();
    }
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="default">Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="link">Link</Button>
      <Button variant="toolbar">Toolbar</Button>
    </div>
  ),
  tags: ["!autodocs"],
};

export const AllSizes: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: "Extra Small" })
    ).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Large" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Add" })).toBeVisible();
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="xs">Extra Small</Button>
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" aria-label="Add">
        <PlusIcon />
      </Button>
    </div>
  ),
  tags: ["!autodocs"],
};
