import type { Meta, StoryObj } from "@storybook/react-vite";

import { PlusIcon } from "lucide-react";
import { expect, userEvent, within } from "storybook/test";

import { Button } from "./button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

const meta = {
  component: Tooltip,
  decorators: [
    (Story) => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
  title: "UI/Tooltip",
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvasElement.querySelector(
      "[data-slot='tooltip-trigger']"
    ) as HTMLElement;
    await expect(trigger).toBeTruthy();
    await userEvent.hover(trigger);
    await expect(
      await body.findByText("This is a tooltip")
    ).toBeInTheDocument();
    await userEvent.unhover(trigger);
  },
  render: () => (
    <Tooltip>
      <TooltipTrigger render={<Button variant="outline">Hover me</Button>} />
      <TooltipContent>This is a tooltip</TooltipContent>
    </Tooltip>
  ),
};

export const OnIconButton: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvasElement.querySelector(
      "[data-slot='tooltip-trigger']"
    ) as HTMLElement;
    await userEvent.hover(trigger);
    await expect(
      await body.findByText("Add new connection")
    ).toBeInTheDocument();
    await userEvent.unhover(trigger);
  },
  render: () => (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button size="icon" variant="ghost" aria-label="Add new">
            <PlusIcon />
          </Button>
        }
      />
      <TooltipContent>Add new connection</TooltipContent>
    </Tooltip>
  ),
};

export const Bottom: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText("Tooltip below")).toBeInTheDocument();
  },
  render: () => (
    <Tooltip defaultOpen>
      <TooltipTrigger render={<Button variant="outline">Below</Button>} />
      <TooltipContent side="bottom">Tooltip below</TooltipContent>
    </Tooltip>
  ),
};

export const Left: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(
      await body.findByText("Tooltip on the left")
    ).toBeInTheDocument();
  },
  render: () => (
    <div className="ml-40">
      <Tooltip defaultOpen>
        <TooltipTrigger render={<Button variant="outline">Left</Button>} />
        <TooltipContent side="left">Tooltip on the left</TooltipContent>
      </Tooltip>
    </div>
  ),
};

export const Right: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(
      await body.findByText("Tooltip on the right")
    ).toBeInTheDocument();
  },
  render: () => (
    <Tooltip defaultOpen>
      <TooltipTrigger render={<Button variant="outline">Right</Button>} />
      <TooltipContent side="right">Tooltip on the right</TooltipContent>
    </Tooltip>
  ),
};
