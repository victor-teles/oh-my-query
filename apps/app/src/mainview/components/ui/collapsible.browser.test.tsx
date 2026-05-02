import { ChevronsUpDownIcon } from "lucide-react";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { Button } from "./button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./collapsible";

describe("collapsible", () => {
  it("default", async () => {
    const screen = render(
      <Collapsible className="w-72 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Tables</span>
          <CollapsibleTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="Toggle">
                <ChevronsUpDownIcon />
              </Button>
            }
          />
        </div>
        <div className="rounded-md border px-3 py-2 text-xs">users</div>
        <CollapsibleContent className="space-y-2">
          <div className="rounded-md border px-3 py-2 text-xs">orders</div>
          <div className="rounded-md border px-3 py-2 text-xs">products</div>
        </CollapsibleContent>
      </Collapsible>
    );
    await expect.element(screen.getByText("users")).toBeVisible();

    const toggle = screen.getByRole("button", { name: "Toggle" });
    await toggle.click();
    await expect.element(screen.getByText("orders")).toBeVisible();
    await expect.element(screen.getByText("products")).toBeVisible();

    await toggle.click();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("defaultOpen", async () => {
    const screen = render(
      <Collapsible defaultOpen className="w-72 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Columns</span>
          <CollapsibleTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Toggle columns"
              >
                <ChevronsUpDownIcon />
              </Button>
            }
          />
        </div>
        <div className="rounded-md border px-3 py-2 text-xs">id</div>
        <CollapsibleContent className="space-y-2">
          <div className="rounded-md border px-3 py-2 text-xs">name</div>
          <div className="rounded-md border px-3 py-2 text-xs">email</div>
        </CollapsibleContent>
      </Collapsible>
    );
    await expect.element(screen.getByText("name")).toBeVisible();
    await expect.element(screen.getByText("email")).toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });
});
