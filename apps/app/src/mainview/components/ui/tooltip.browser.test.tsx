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
    expect(page.getByText("This is a tooltip")).toBeInTheDocument();
    expect(page.getByText("This is a tooltip").element()).toMatchSnapshot();
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
    expect(page.getByText("Add new connection")).toBeInTheDocument();
    expect(page.getByText("Add new connection").element()).toMatchSnapshot();
  });

  it("bottom", () => {
    render(
      <TooltipProvider>
        <Tooltip defaultOpen>
          <TooltipTrigger render={<Button variant="outline">Below</Button>} />
          <TooltipContent side="bottom">Tooltip below</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    expect(page.getByText("Tooltip below")).toBeInTheDocument();
    expect(page.getByText("Tooltip below").element()).toMatchSnapshot();
  });

  it("left", () => {
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
    expect(page.getByText("Tooltip on the left")).toBeInTheDocument();
    expect(page.getByText("Tooltip on the left").element()).toMatchSnapshot();
  });

  it("right", () => {
    render(
      <TooltipProvider>
        <Tooltip defaultOpen>
          <TooltipTrigger render={<Button variant="outline">Right</Button>} />
          <TooltipContent side="right">Tooltip on the right</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    expect(page.getByText("Tooltip on the right")).toBeInTheDocument();
    expect(page.getByText("Tooltip on the right").element()).toMatchSnapshot();
  });
});
