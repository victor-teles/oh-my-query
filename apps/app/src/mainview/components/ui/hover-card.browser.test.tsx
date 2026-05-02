import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card";

describe("hover-card", () => {
  it("default", async () => {
    render(
      <HoverCard defaultOpen>
        <HoverCardTrigger
          render={
            <span className="cursor-pointer text-xs underline underline-offset-4">
              users
            </span>
          }
        />
        <HoverCardContent>
          <div className="space-y-1">
            <h4 className="text-sm font-medium">public.users</h4>
            <p className="text-xs text-muted-foreground">
              12 columns &middot; 1,482 rows
            </p>
            <p className="text-xs text-muted-foreground">
              Primary key: id (uuid)
            </p>
          </div>
        </HoverCardContent>
      </HoverCard>
    );
    await expect.element(page.getByText("public.users")).toBeInTheDocument();
    await expect.element(page.getByText("public.users")).toMatchScreenshot();
  });
});
