import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { Separator } from "./separator";

describe("separator", () => {
  it("inContext", async () => {
    const screen = render(
      <div className="space-y-1 p-4" data-testid="root">
        <div className="text-sm font-medium">oh-my-query</div>
        <p className="text-xs text-muted-foreground">
          A desktop app for querying databases.
        </p>
        <Separator />
        <div className="flex h-5 items-center gap-4 text-xs">
          <span>Docs</span>
          <Separator orientation="vertical" />
          <span>Source</span>
          <Separator orientation="vertical" />
          <span>Settings</span>
        </div>
      </div>
    );
    expect(
      screen.container.querySelectorAll('[role="separator"]')
    ).toHaveLength(3);
    await expect.element(screen.getByTestId("root")).toMatchScreenshot();
  });
});
