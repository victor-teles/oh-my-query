import type { Meta, StoryObj } from "@storybook/react-vite";

import { expect, userEvent } from "storybook/test";

import { Checkbox } from "./checkbox";
import { Input } from "./input";
import { Label } from "./label";

const meta = {
  args: {
    children: "Email address",
  },
  component: Label,
  title: "UI/Label",
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    const label = canvas.getByText("Email address");
    await expect(label).toBeVisible();
    await expect(label.tagName).toBe("LABEL");
  },
};

export const WithCheckbox: Story = {
  play: async ({ canvas }) => {
    const checkbox = canvas.getByRole("checkbox");
    await expect(checkbox).not.toBeChecked();
    const label = canvas.getByText("Accept terms and conditions");
    await userEvent.click(label);
    await expect(checkbox).toBeChecked();
  },
  render: () => (
    <Label>
      <Checkbox />
      Accept terms and conditions
    </Label>
  ),
};

export const WithInput: Story = {
  play: async ({ canvas }) => {
    const input = canvas.getByLabelText("Full name");
    await expect(input).toBeVisible();
    await userEvent.click(canvas.getByText("Full name"));
    await expect(input).toHaveFocus();
  },
  render: () => (
    <div className="grid gap-1.5">
      <Label htmlFor="name">Full name</Label>
      <Input id="name" placeholder="John Doe" />
    </div>
  ),
};
