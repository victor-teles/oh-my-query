import type { Meta, StoryObj } from "@storybook/react-vite";

import { expect, userEvent } from "storybook/test";

import { Input } from "./input";
import { Label } from "./label";

const meta = {
  args: {
    placeholder: "Type something...",
  },
  component: Input,
  title: "UI/Input",
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    const input = canvas.getByPlaceholderText("Type something...");
    await expect(input).toBeVisible();
    await userEvent.click(input);
    await expect(input).toHaveFocus();
    await userEvent.type(input, "Hello world");
    await expect(input).toHaveValue("Hello world");
  },
};

export const WithLabel: Story = {
  play: async ({ canvas }) => {
    const label = canvas.getByText("Email");
    await expect(label).toBeVisible();
    const input = canvas.getByLabelText("Email");
    await userEvent.click(input);
    await expect(input).toHaveFocus();
    await userEvent.type(input, "user@test.com");
    await expect(input).toHaveValue("user@test.com");
  },
  render: (args) => (
    <div className="grid gap-1.5">
      <Label htmlFor="email">Email</Label>
      <Input {...args} id="email" type="email" placeholder="you@example.com" />
    </div>
  ),
};

export const Password: Story = {
  args: { placeholder: "Enter password", type: "password" },
  play: async ({ canvas }) => {
    const input = canvas.getByPlaceholderText("Enter password");
    await userEvent.type(input, "secret123");
    await expect(input).toHaveValue("secret123");
    await expect(input).toHaveAttribute("type", "password");
  },
};

export const Disabled: Story = {
  args: { defaultValue: "Disabled input", disabled: true },
  play: async ({ canvas }) => {
    const input = canvas.getByDisplayValue("Disabled input");
    await expect(input).toBeDisabled();
  },
};

export const Invalid: Story = {
  args: { "aria-invalid": true, defaultValue: "Bad value" },
  play: async ({ canvas }) => {
    const input = canvas.getByDisplayValue("Bad value");
    await expect(input).toHaveAttribute("aria-invalid", "true");
  },
};

export const File: Story = {
  args: { placeholder: undefined, type: "file" },
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector("input[type='file']");
    await expect(input).toBeTruthy();
  },
};
