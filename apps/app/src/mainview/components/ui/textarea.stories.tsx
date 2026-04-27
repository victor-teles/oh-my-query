import type { Meta, StoryObj } from "@storybook/react-vite";

import { expect, userEvent } from "storybook/test";

import { Label } from "./label";
import { Textarea } from "./textarea";

const meta = {
  args: {
    placeholder: "Type your message...",
  },
  component: Textarea,
  title: "UI/Textarea",
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    const textarea = canvas.getByPlaceholderText("Type your message...");
    await expect(textarea).toBeVisible();
    await userEvent.click(textarea);
    await expect(textarea).toHaveFocus();
    await userEvent.type(textarea, "SELECT * FROM users;");
    await expect(textarea).toHaveValue("SELECT * FROM users;");
  },
};

export const WithLabel: Story = {
  play: async ({ canvas }) => {
    const textarea = canvas.getByLabelText("Message");
    await userEvent.click(textarea);
    await expect(textarea).toHaveFocus();
    await userEvent.type(textarea, "A multi-line\ntext input");
    await expect(textarea).toHaveValue("A multi-line\ntext input");
  },
  render: (args) => (
    <div className="grid gap-1.5">
      <Label htmlFor="message">Message</Label>
      <Textarea {...args} id="message" />
    </div>
  ),
};

export const Disabled: Story = {
  args: { defaultValue: "Cannot edit this", disabled: true },
  play: async ({ canvas }) => {
    const textarea = canvas.getByDisplayValue("Cannot edit this");
    await expect(textarea).toBeDisabled();
  },
};

export const Invalid: Story = {
  args: { "aria-invalid": true, defaultValue: "Invalid content" },
  play: async ({ canvas }) => {
    const textarea = canvas.getByDisplayValue("Invalid content");
    await expect(textarea).toHaveAttribute("aria-invalid", "true");
  },
};
