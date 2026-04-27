import type { Meta, StoryObj } from "@storybook/react-vite";

import { CopyIcon, EyeIcon, SearchIcon } from "lucide-react";
import { expect, userEvent } from "storybook/test";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "./input-group";
import { Kbd } from "./kbd";

const meta = {
  component: InputGroup,
  title: "UI/InputGroup",
} satisfies Meta<typeof InputGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithIcon: Story = {
  play: async ({ canvas }) => {
    const input = canvas.getByPlaceholderText("Search tables...");
    await userEvent.type(input, "users");
    await expect(input).toHaveValue("users");
  },
  render: () => (
    <InputGroup className="w-64">
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput placeholder="Search tables..." />
    </InputGroup>
  ),
};

export const WithButton: Story = {
  play: async ({ canvas }) => {
    const input = canvas.getByPlaceholderText("Password");
    await expect(input).toHaveAttribute("type", "password");
  },
  render: () => (
    <InputGroup className="w-64">
      <InputGroupInput type="password" placeholder="Password" />
      <InputGroupAddon align="inline-end">
        <InputGroupButton aria-label="Show password">
          <EyeIcon />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  ),
};

export const WithKbd: Story = {
  render: () => (
    <InputGroup className="w-72">
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput placeholder="Search..." />
      <InputGroupAddon align="inline-end">
        <Kbd>⌘K</Kbd>
      </InputGroupAddon>
    </InputGroup>
  ),
};

export const WithTrailingButton: Story = {
  render: () => (
    <InputGroup className="w-72">
      <InputGroupInput placeholder="Connection string" />
      <InputGroupAddon align="inline-end">
        <InputGroupButton aria-label="Copy">
          <CopyIcon />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  ),
};
