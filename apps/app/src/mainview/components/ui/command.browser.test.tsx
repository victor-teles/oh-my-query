import {
  DatabaseIcon,
  FileTextIcon,
  PlusIcon,
  SettingsIcon,
} from "lucide-react";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

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

describe("command", () => {
  it("default", async () => {
    const screen = render(
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
    );
    expect(screen.getByText("New Connection")).toBeVisible();
    await expect(screen.getByText("Settings")).toBeVisible();
    const input = screen.getByPlaceholder("Type a command or search...");
    await input.fill("settings");
    expect(screen.getByText("Settings")).toBeVisible();
    expect(screen.container).toMatchSnapshot();
  });

  it("empty", () => {
    const screen = render(
      <Command className="w-80 rounded-lg border shadow-md">
        <CommandInput placeholder="Search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
        </CommandList>
      </Command>
    );
    expect(screen.getByText("No results found.")).toBeVisible();
    expect(screen.container).toMatchSnapshot();
  });
});
