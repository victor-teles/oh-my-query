import {
  CopyIcon,
  LogOutIcon,
  PencilIcon,
  SettingsIcon,
  TrashIcon,
  UserIcon,
} from "lucide-react";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "./dropdown-menu";

describe("dropdown-menu", () => {
  it("default", async () => {
    const screen = render(
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline">Open Menu</Button>}
        />
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <UserIcon />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <SettingsIcon />
              Settings
              <DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <LogOutIcon />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    const trigger = screen.getByRole("button", { name: "Open Menu" });
    expect(trigger).toBeVisible();
    await trigger.click();
    expect(page.getByRole("menu")).toBeVisible();
    await expect(page.getByRole("menu").element()).toMatchSnapshot();
  });

  it("withActions", async () => {
    const screen = render(
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline">Actions</Button>}
        />
        <DropdownMenuContent>
          <DropdownMenuItem>
            <CopyIcon />
            Copy query
          </DropdownMenuItem>
          <DropdownMenuItem>
            <PencilIcon />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">
            <TrashIcon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    await screen.getByRole("button", { name: "Actions" }).click();
    expect(page.getByRole("menu")).toBeVisible();
    expect(page.getByRole("menu").element()).toMatchSnapshot();
  });
});
