import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { AppProviders } from "./app-providers";

describe("app-providers", () => {
  it("wraps children inside the provider tree", () => {
    const screen = render(
      <AppProviders>
        <span>hello</span>
      </AppProviders>
    );
    expect(screen.getByText("hello")).toBeVisible();
  });
});
