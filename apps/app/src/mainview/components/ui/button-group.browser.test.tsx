import { BoldIcon, ItalicIcon, UnderlineIcon } from "lucide-react";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { Button } from "./button";
import { ButtonGroup, ButtonGroupSeparator } from "./button-group";

describe("button-group", () => {
  it("default", async () => {
    const screen = render(
      <ButtonGroup>
        <Button variant="outline">Left</Button>
        <Button variant="outline">Center</Button>
        <Button variant="outline">Right</Button>
      </ButtonGroup>
    );
    expect(screen.getByRole("group")).toBeVisible();
    await expect(screen.getByRole("button", { name: "Left" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Right" })).toBeVisible();
    expect(screen.container).toMatchSnapshot();
  });

  it("withIcons", () => {
    const screen = render(
      <ButtonGroup>
        <Button variant="outline" size="icon" aria-label="Bold">
          <BoldIcon />
        </Button>
        <Button variant="outline" size="icon" aria-label="Italic">
          <ItalicIcon />
        </Button>
        <Button variant="outline" size="icon" aria-label="Underline">
          <UnderlineIcon />
        </Button>
      </ButtonGroup>
    );
    expect(screen.getByRole("button", { name: "Bold" })).toBeVisible();
    expect(screen.container).toMatchSnapshot();
  });

  it("withSeparator", () => {
    const screen = render(
      <ButtonGroup>
        <Button variant="outline">Copy</Button>
        <ButtonGroupSeparator />
        <Button variant="outline">Paste</Button>
      </ButtonGroup>
    );
    expect(screen.container).toMatchSnapshot();
  });

  it("vertical", () => {
    const screen = render(
      <ButtonGroup orientation="vertical">
        <Button variant="outline">Top</Button>
        <Button variant="outline">Middle</Button>
        <Button variant="outline">Bottom</Button>
      </ButtonGroup>
    );
    const group = screen.container.querySelector("[data-slot='button-group']");
    expect(group).toHaveAttribute("data-orientation", "vertical");
    expect(screen.container).toMatchSnapshot();
  });
});
