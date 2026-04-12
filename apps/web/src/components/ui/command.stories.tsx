import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  DatabaseIcon,
  FileTextIcon,
  PlusIcon,
  SettingsIcon,
} from "lucide-react";
import { expect, userEvent } from "storybook/test";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "./command";

const meta = {
  component: Command,
  title: "UI/Command",
} satisfies Meta<typeof Command>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("New Connection")).toBeVisible();
    await expect(canvas.getByText("Settings")).toBeVisible();
    const input = canvas.getByPlaceholderText("Type a command or search...");
    await userEvent.type(input, "settings");
    await expect(canvas.getByText("Settings")).toBeVisible();
  },
  render: () => (
    <Command className="w-80 rounded-lg border shadow-md">
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem>
            <PlusIcon />
            New Connection
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <FileTextIcon />
            New Query
            <CommandShortcut>⌘T</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Navigation">
          <CommandItem>
            <DatabaseIcon />
            Connections
          </CommandItem>
          <CommandItem>
            <SettingsIcon />
            Settings
            <CommandShortcut>⌘,</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};

export const Empty: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No results found.")).toBeVisible();
  },
  render: () => (
    <Command className="w-80 rounded-lg border shadow-md">
      <CommandInput placeholder="Search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
      </CommandList>
    </Command>
  ),
};
