import { CopyIcon, EyeIcon, SearchIcon } from "lucide-react";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "./input-group";
import { Kbd } from "./kbd";

describe("input-group", () => {
  it("withIcon", async () => {
    const screen = render(
      <InputGroup className="w-64">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput placeholder="Search tables..." />
      </InputGroup>
    );
    const input = screen.getByPlaceholder("Search tables...");
    await input.fill("users");
    await expect.element(input).toHaveValue("users");
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("withButton", async () => {
    const screen = render(
      <InputGroup className="w-64">
        <InputGroupInput placeholder="Password" type="password" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton aria-label="Show password">
            <EyeIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    );
    const input = screen.getByPlaceholder("Password");
    await expect.element(input).toHaveAttribute("type", "password");
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("withKbd", async () => {
    const screen = render(
      <InputGroup className="w-72">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput placeholder="Search..." />
        <InputGroupAddon align="inline-end">
          <Kbd>⌘K</Kbd>
        </InputGroupAddon>
      </InputGroup>
    );
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("withTrailingButton", async () => {
    const screen = render(
      <InputGroup className="w-72">
        <InputGroupInput placeholder="Connection string" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton aria-label="Copy">
            <CopyIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    );
    await expect.element(screen.container).toMatchScreenshot();
  });
});
