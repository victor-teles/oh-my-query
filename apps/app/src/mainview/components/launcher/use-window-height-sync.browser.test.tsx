import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { mockIpc } from "@/test/ipc-mock";
import { nextFrame } from "@/test/wait";

import { useWindowHeightSync } from "./use-window-height-sync";

const resize = vi.fn();

function Probe({ height, reduced }: { height: number; reduced: boolean }) {
  const { panelRef, settle } = useWindowHeightSync({ margin: 20, reduced });
  return (
    <>
      <div ref={panelRef} style={{ height }} />
      <button onClick={settle} type="button">
        settle
      </button>
    </>
  );
}

const lastHeight = () =>
  (resize.mock.lastCall?.[0] as { height: number } | undefined)?.height;

describe("useWindowHeightSync", () => {
  it("grows the window right away, including the margins", async () => {
    resize.mockReset();
    mockIpc({ resizeLauncher: (payload) => resize(payload) });
    const screen = render(<Probe height={100} reduced={false} />);
    await expect.poll(lastHeight).toBe(140);

    await screen.rerender(<Probe height={300} reduced={false} />);
    await expect.poll(lastHeight).toBe(340);
  });

  it("defers shrinking until the layout animation settles", async () => {
    resize.mockReset();
    mockIpc({ resizeLauncher: (payload) => resize(payload) });
    const screen = render(<Probe height={300} reduced={false} />);
    await expect.poll(lastHeight).toBe(340);

    await screen.rerender(<Probe height={100} reduced={false} />);
    await nextFrame();
    expect(lastHeight()).toBe(340);

    await screen.getByRole("button", { name: "settle" }).click();
    expect(lastHeight()).toBe(140);
  });

  it("shrinks on its own when no layout animation reports back", async () => {
    resize.mockReset();
    mockIpc({ resizeLauncher: (payload) => resize(payload) });
    const screen = render(<Probe height={300} reduced={false} />);
    await expect.poll(lastHeight).toBe(340);

    await screen.rerender(<Probe height={120} reduced={false} />);
    await expect.poll(lastHeight, { timeout: 2000 }).toBe(160);
  });

  it("follows the content immediately under reduced motion", async () => {
    resize.mockReset();
    mockIpc({ resizeLauncher: (payload) => resize(payload) });
    const screen = render(<Probe height={300} reduced />);
    await expect.poll(lastHeight).toBe(340);

    await screen.rerender(<Probe height={100} reduced />);
    await expect.poll(lastHeight).toBe(140);
  });
});
