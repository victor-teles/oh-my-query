import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { IslandProvider } from "@/contexts/island-context";

import { AppIsland } from "./dynamic-island";

describe("app-island", () => {
  it("renders nothing visible when the snapshot is hidden", () => {
    const screen = render(
      <IslandProvider>
        <AppIsland />
      </IslandProvider>
    );
    expect(screen.getByRole("status").query()).toBeNull();
    expect(screen.getByRole("alert").query()).toBeNull();
  });
});
