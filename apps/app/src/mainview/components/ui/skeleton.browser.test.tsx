import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { Skeleton } from "./skeleton";

describe("skeleton", () => {
  it("default", async () => {
    const screen = render(<Skeleton className="h-4 w-48" />);
    const skeleton = screen.container.querySelector("[data-slot='skeleton']");
    expect(skeleton).toBeTruthy();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("circle", async () => {
    const screen = render(<Skeleton className="size-10 rounded-full" />);
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("cardPlaceholder", async () => {
    const screen = render(
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
    );
    await expect.element(screen.container).toMatchScreenshot();
  });
});
