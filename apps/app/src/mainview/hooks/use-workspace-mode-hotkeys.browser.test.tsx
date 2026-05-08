import type { ReactNode } from "react";

import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { WorkspaceMode } from "@/lib/workspace-mode";

import { useWorkspaceModeHotkeys } from "@/hooks/use-workspace-mode-hotkeys";

const Wrapper = ({ children }: { children: ReactNode }) => (
  <HotkeysProvider>{children}</HotkeysProvider>
);

const Harness = ({ setMode }: { setMode: (m: WorkspaceMode) => void }) => {
  useWorkspaceModeHotkeys({ setMode });
  return null;
};

const isMacPlatform =
  typeof navigator !== "undefined" &&
  (navigator.platform.toLowerCase().includes("mac") ||
    navigator.userAgent.toLowerCase().includes("mac"));

const fireMeta = (key: string, shift = true) => {
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      ctrlKey: !isMacPlatform,
      key,
      metaKey: isMacPlatform,
      shiftKey: shift,
    })
  );
};

describe("useWorkspaceModeHotkeys", () => {
  it("mod+Shift+1 sets editor mode", () => {
    const setMode = vi.fn();
    render(
      <Wrapper>
        <Harness setMode={setMode} />
      </Wrapper>
    );
    fireMeta("1");
    expect(setMode).toHaveBeenCalledWith("editor");
  });

  it("mod+Shift+2 sets split mode", () => {
    const setMode = vi.fn();
    render(
      <Wrapper>
        <Harness setMode={setMode} />
      </Wrapper>
    );
    fireMeta("2");
    expect(setMode).toHaveBeenCalledWith("split");
  });

  it("mod+Shift+3 sets chat mode", () => {
    const setMode = vi.fn();
    render(
      <Wrapper>
        <Harness setMode={setMode} />
      </Wrapper>
    );
    fireMeta("3");
    expect(setMode).toHaveBeenCalledWith("chat");
  });
});
