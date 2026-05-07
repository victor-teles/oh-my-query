import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { KeysPanelHeader } from "./keys-panel-header";

const baseProps = {
  dbIndex: 0,
  isLoading: false,
  onPatternChange: vi.fn(),
  onRefresh: vi.fn(),
  onSelectDb: vi.fn(),
  patternFocusKey: 0,
  totalKeys: null,
};

describe("keys-panel-header", () => {
  it("invokes onRefresh when the refresh button is clicked", async () => {
    const onRefresh = vi.fn();
    const screen = render(
      <KeysPanelHeader {...baseProps} onRefresh={onRefresh} />
    );
    await screen.getByRole("button", { name: "Refresh keys" }).click();
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("disables the refresh button while loading", () => {
    const screen = render(<KeysPanelHeader {...baseProps} isLoading />);
    expect(screen.getByRole("button", { name: "Refresh keys" })).toBeDisabled();
  });
});
