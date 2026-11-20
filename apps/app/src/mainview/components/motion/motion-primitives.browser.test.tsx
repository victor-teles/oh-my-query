import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { Pressable } from "./pressable";
import { Reveal } from "./reveal";
import { SwapText } from "./swap-text";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

describe.each([
  ["full motion", false],
  ["reduced motion", true],
])("motion primitives with %s", (_label, isReduced) => {
  it("pressable renders a button that runs its handler", async () => {
    reduced.value = isReduced;
    const onClick = vi.fn();
    const screen = render(<Pressable onClick={onClick}>Run</Pressable>);
    const button = screen.getByRole("button", { name: "Run" });

    expect(button.element().getAttribute("type")).toBe("button");
    await button.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("swapText shows the current value and replaces it on change", async () => {
    reduced.value = isReduced;
    const screen = render(<SwapText value="Open" />);
    await expect.element(screen.getByText("Open")).toBeVisible();

    await screen.rerender(<SwapText value="Hide" />);
    await expect.element(screen.getByText("Hide")).toBeVisible();
    await expect.poll(() => screen.getByText("Open").query()).toBeNull();
  });

  it("reveal settles its children fully visible", async () => {
    reduced.value = isReduced;
    const screen = render(
      <Reveal className="reveal-probe" delay={0.01}>
        <p>Ready</p>
      </Reveal>
    );
    await expect.element(screen.getByText("Ready")).toBeVisible();
    await expect
      .poll(
        () =>
          screen.container.querySelector<HTMLElement>(".reveal-probe")?.style
            .opacity
      )
      .toBe("1");
  });
});
