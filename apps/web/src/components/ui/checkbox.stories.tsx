import type { Meta, StoryObj } from "@storybook/react-vite";

import { expect, fn, userEvent } from "storybook/test";

import { Checkbox } from "./checkbox";
import { Label } from "./label";

const meta = {
  args: {
    onCheckedChange: fn(),
  },
  component: Checkbox,
  title: "UI/Checkbox",
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvas }) => {
    const checkbox = canvas.getByRole("checkbox");
    await expect(checkbox).toBeVisible();
    await expect(checkbox).not.toBeChecked();
    await userEvent.click(checkbox);
    await expect(args.onCheckedChange).toHaveBeenCalledOnce();
  },
};

export const Checked: Story = {
  args: { defaultChecked: true },
  play: async ({ canvas }) => {
    const checkbox = canvas.getByRole("checkbox");
    await expect(checkbox).toBeChecked();
  },
};

export const WithLabel: Story = {
  play: async ({ args, canvas }) => {
    const checkbox = canvas.getByRole("checkbox");
    await expect(checkbox).not.toBeChecked();
    const label = canvas.getByText("Remember me");
    await userEvent.click(label);
    await expect(args.onCheckedChange).toHaveBeenCalled();
  },
  render: (args) => (
    <Label>
      <Checkbox {...args} />
      Remember me
    </Label>
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas }) => {
    const checkbox = canvas.getByRole("checkbox");
    await expect(checkbox).toHaveAttribute("aria-disabled", "true");
  },
};

export const DisabledChecked: Story = {
  args: { defaultChecked: true, disabled: true },
  play: async ({ canvas }) => {
    const checkbox = canvas.getByRole("checkbox");
    await expect(checkbox).toHaveAttribute("aria-disabled", "true");
    await expect(checkbox).toBeChecked();
  },
};
