import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { KeysGateBanner } from "./keys-gate-banner";

describe("keys-gate-banner", () => {
  it("formats large key counts with thousands separators", () => {
    const screen = render(
      <KeysGateBanner onScanAll={vi.fn()} totalKeys={1_234_567} />
    );

    expect(screen.getByText(/1,234,567 keys/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /scan all anyway/i })
    ).toBeInTheDocument();
    expect(screen.container).toMatchSnapshot();
  });

  it("requires a confirm click before firing onScanAll", async () => {
    const onScanAll = vi.fn();
    const screen = render(
      <KeysGateBanner onScanAll={onScanAll} totalKeys={500} />
    );

    await screen.getByRole("button", { name: /scan all anyway/i }).click();
    expect(onScanAll).not.toHaveBeenCalled();

    await screen.getByRole("button", { name: /scan 500 keys anyway/i }).click();
    expect(onScanAll).toHaveBeenCalledOnce();
  });

  it("cancels confirmation back to the initial state", async () => {
    const screen = render(
      <KeysGateBanner onScanAll={vi.fn()} totalKeys={42} />
    );

    await screen.getByRole("button", { name: /scan all anyway/i }).click();
    await screen.getByRole("button", { name: /cancel/i }).click();

    expect(
      screen.getByRole("button", { name: /scan all anyway/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i }).query()).toBeNull();
  });
});
