import { describe, expect, it, vi } from "vitest";

import { renderHook } from "@/test/render-hook";

const navigate = vi.fn();

vi.mock(import("@tanstack/react-router"), () => ({
  useNavigate: () => navigate,
}));

const menuHandlers: ((route: string) => void)[] = [];

vi.mock(import("@/lib/ipc"), () => ({
  onMenuNavigate: (handler: (route: string) => void) => {
    menuHandlers.push(handler);
    return () => {
      const i = menuHandlers.indexOf(handler);
      if (i !== -1) {
        menuHandlers.splice(i, 1);
      }
    };
  },
}));

const { useMenuNavigation } = await import("@/hooks/use-menu-navigation");

describe("useMenuNavigation", () => {
  it("navigates to /settings when the menu emits a known route", () => {
    navigate.mockClear();
    renderHook(() => useMenuNavigation());
    menuHandlers.at(-1)?.("/settings");
    expect(navigate).toHaveBeenCalledWith({ to: "/settings" });
  });

  it("ignores unknown routes", () => {
    navigate.mockClear();
    renderHook(() => useMenuNavigation());
    menuHandlers.at(-1)?.("/unknown");
    expect(navigate).not.toHaveBeenCalled();
  });
});
