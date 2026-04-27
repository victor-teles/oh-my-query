import type { Meta, StoryObj } from "@storybook/react-vite";

import { expect, userEvent, within } from "storybook/test";

import { Label } from "./label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select";

const meta = {
  component: Select,
  title: "UI/Select",
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector(
      "[data-slot='select-trigger']"
    ) as HTMLElement;
    await expect(trigger).toBeTruthy();
    await userEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText("MySQL")).toBeInTheDocument();
  },
  render: () => (
    <Select defaultValue="postgres">
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Select database" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="postgres">PostgreSQL</SelectItem>
        <SelectItem value="mysql">MySQL</SelectItem>
        <SelectItem value="sqlite">SQLite</SelectItem>
        <SelectItem value="mongo">MongoDB</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const WithLabel: Story = {
  render: () => (
    <div className="grid gap-1.5">
      <Label>Database Type</Label>
      <Select>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Select type..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="postgres">PostgreSQL</SelectItem>
          <SelectItem value="mysql">MySQL</SelectItem>
          <SelectItem value="sqlite">SQLite</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const WithGroups: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Select database..." />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>SQL</SelectLabel>
          <SelectItem value="postgres">PostgreSQL</SelectItem>
          <SelectItem value="mysql">MySQL</SelectItem>
          <SelectItem value="sqlite">SQLite</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>NoSQL</SelectLabel>
          <SelectItem value="mongo">MongoDB</SelectItem>
          <SelectItem value="redis">Redis</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};

export const Small: Story = {
  render: () => (
    <Select defaultValue="50">
      <SelectTrigger size="sm" className="w-24">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="10">10 rows</SelectItem>
        <SelectItem value="25">25 rows</SelectItem>
        <SelectItem value="50">50 rows</SelectItem>
        <SelectItem value="100">100 rows</SelectItem>
      </SelectContent>
    </Select>
  ),
};
