import { describe, expect, it, vi } from "vitest";

import { useTitlebarDoubleClick } from "@/hooks/use-titlebar-double-click";
import { renderHook } from "@/test/render-hook";
import { mockTauri } from "@/test/tauri-mock";

const fireDoubleClick = (target: EventTarget) => {
  const event = new MouseEvent("dblclick", { bubbles: true, button: 0 });
  target.dispatchEvent(event);
};

describe("useTitlebarDoubleClick", () => {
  it("calls toggleWindowMaximize when double-clicking a drag region", () => {
    const toggle = vi.fn(() => true);
    mockTauri({ toggleWindowMaximize: toggle });

    const dragRegion = document.createElement("div");
    dragRegion.className = "electrobun-webkit-app-region-drag";
    document.body.append(dragRegion);

    renderHook(() => useTitlebarDoubleClick());
    fireDoubleClick(dragRegion);

    expect(toggle).toHaveBeenCalledOnce();

    dragRegion.remove();
  });

  it("ignores double-clicks inside a no-drag region nested in a drag region", () => {
    const toggle = vi.fn(() => true);
    mockTauri({ toggleWindowMaximize: toggle });

    const dragRegion = document.createElement("div");
    dragRegion.className = "electrobun-webkit-app-region-drag";
    const noDragChild = document.createElement("span");
    noDragChild.className = "electrobun-webkit-app-region-no-drag";
    dragRegion.append(noDragChild);
    document.body.append(dragRegion);

    renderHook(() => useTitlebarDoubleClick());
    fireDoubleClick(noDragChild);

    expect(toggle).not.toHaveBeenCalled();

    dragRegion.remove();
  });

  it("ignores double-clicks outside any drag region", () => {
    const toggle = vi.fn(() => true);
    mockTauri({ toggleWindowMaximize: toggle });

    const plain = document.createElement("div");
    document.body.append(plain);

    renderHook(() => useTitlebarDoubleClick());
    fireDoubleClick(plain);

    expect(toggle).not.toHaveBeenCalled();

    plain.remove();
  });

  it("removes the listener on unmount", () => {
    const toggle = vi.fn(() => true);
    mockTauri({ toggleWindowMaximize: toggle });

    const dragRegion = document.createElement("div");
    dragRegion.className = "electrobun-webkit-app-region-drag";
    document.body.append(dragRegion);

    const { unmount } = renderHook(() => useTitlebarDoubleClick());
    unmount();
    fireDoubleClick(dragRegion);

    expect(toggle).not.toHaveBeenCalled();

    dragRegion.remove();
  });
});
