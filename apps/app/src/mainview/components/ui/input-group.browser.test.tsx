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
    expect(input).toHaveValue("users");
    expect(screen.container).toMatchSnapshot();
  });

  it("withButton", () => {
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
    expect(input).toHaveAttribute("type", "password");
    expect(screen.container).toMatchSnapshot();
  });

  it("withKbd", () => {
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
    expect(screen.container).toMatchSnapshot();
  });

  it("withTrailingButton", () => {
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
    expect(screen.container).toMatchSnapshot();
  });
});
