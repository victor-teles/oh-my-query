import { PlusIcon } from "lucide-react";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { Button } from "./button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

describe("tooltip", () => {
  it("default", async () => {
    const screen = render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={<Button variant="outline">Hover me</Button>}
          />
          <TooltipContent>This is a tooltip</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    const trigger = screen.getByRole("button", { name: "Hover me" });
    await trigger.hover();
    await expect
      .element(page.getByText("This is a tooltip"))
      .toBeInTheDocument();
    await expect
      .element(page.getByText("This is a tooltip"))
      .toMatchScreenshot();
  });

  it("onIconButton", async () => {
    const screen = render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button size="icon" variant="ghost" aria-label="Add new">
                <PlusIcon />
              </Button>
            }
          />
          <TooltipContent>Add new connection</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    const trigger = screen.getByRole("button", { name: "Add new" });
    await trigger.hover();
    await expect
      .element(page.getByText("Add new connection"))
      .toBeInTheDocument();
    await expect
      .element(page.getByText("Add new connection"))
      .toMatchScreenshot();
  });

  it("bottom", async () => {
    render(
      <TooltipProvider>
        <Tooltip defaultOpen>
          <TooltipTrigger render={<Button variant="outline">Below</Button>} />
          <TooltipContent side="bottom">Tooltip below</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    await expect.element(page.getByText("Tooltip below")).toBeInTheDocument();
    await expect.element(page.getByText("Tooltip below")).toMatchScreenshot();
  });

  it("left", async () => {
    render(
      <TooltipProvider>
        <div className="ml-40">
          <Tooltip defaultOpen>
            <TooltipTrigger render={<Button variant="outline">Left</Button>} />
            <TooltipContent side="left">Tooltip on the left</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
    await expect
      .element(page.getByText("Tooltip on the left"))
      .toBeInTheDocument();
    await expect
      .element(page.getByText("Tooltip on the left"))
      .toMatchScreenshot();
  });

  it("right", async () => {
    render(
      <TooltipProvider>
        <Tooltip defaultOpen>
          <TooltipTrigger render={<Button variant="outline">Right</Button>} />
          <TooltipContent side="right">Tooltip on the right</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    await expect
      .element(page.getByText("Tooltip on the right"))
      .toBeInTheDocument();
    await expect
      .element(page.getByText("Tooltip on the right"))
      .toMatchScreenshot();
  });
});
