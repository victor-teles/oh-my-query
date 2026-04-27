import type { Meta, StoryObj } from "@storybook/react-vite";

import { BoldIcon, ItalicIcon, UnderlineIcon } from "lucide-react";
import { expect } from "storybook/test";

import { Button } from "./button";
import { ButtonGroup, ButtonGroupSeparator } from "./button-group";

const meta = {
  component: ButtonGroup,
  title: "UI/ButtonGroup",
} satisfies Meta<typeof ButtonGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("group")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Left" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Right" })).toBeVisible();
  },
  render: () => (
    <ButtonGroup>
      <Button variant="outline">Left</Button>
      <Button variant="outline">Center</Button>
      <Button variant="outline">Right</Button>
    </ButtonGroup>
  ),
};

export const WithIcons: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Bold" })).toBeVisible();
  },
  render: () => (
    <ButtonGroup>
      <Button variant="outline" size="icon" aria-label="Bold">
        <BoldIcon />
      </Button>
      <Button variant="outline" size="icon" aria-label="Italic">
        <ItalicIcon />
      </Button>
      <Button variant="outline" size="icon" aria-label="Underline">
        <UnderlineIcon />
      </Button>
    </ButtonGroup>
  ),
};

export const WithSeparator: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline">Copy</Button>
      <ButtonGroupSeparator />
      <Button variant="outline">Paste</Button>
    </ButtonGroup>
  ),
};

export const Vertical: Story = {
  play: async ({ canvasElement }) => {
    const group = canvasElement.querySelector("[data-slot='button-group']");
    await expect(group).toHaveAttribute("data-orientation", "vertical");
  },
  render: () => (
    <ButtonGroup orientation="vertical">
      <Button variant="outline">Top</Button>
      <Button variant="outline">Middle</Button>
      <Button variant="outline">Bottom</Button>
    </ButtonGroup>
  ),
};
