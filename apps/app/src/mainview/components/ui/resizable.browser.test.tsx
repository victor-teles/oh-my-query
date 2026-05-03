import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./resizable";

describe("resizable", () => {
  it("horizontal", async () => {
    const screen = render(
      <ResizablePanelGroup
        className="min-h-48 max-w-lg rounded-lg border"
        orientation="horizontal"
      >
        <ResizablePanel defaultSize={30} minSize={20}>
          <div className="flex h-full items-center justify-center p-4">
            <span className="text-xs text-muted-foreground">Sidebar</span>
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={70}>
          <div className="flex h-full items-center justify-center p-4">
            <span className="text-xs text-muted-foreground">Content</span>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    );
    expect(screen.getByText("Sidebar")).toBeVisible();
    await expect(screen.getByText("Content")).toBeVisible();
    expect(screen.container).toMatchSnapshot();
  });

  it("vertical", () => {
    const screen = render(
      <ResizablePanelGroup
        className="min-h-64 max-w-lg rounded-lg border"
        orientation="vertical"
      >
        <ResizablePanel defaultSize={60}>
          <div className="flex h-full items-center justify-center p-4">
            <span className="text-xs text-muted-foreground">Editor</span>
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={40}>
          <div className="flex h-full items-center justify-center p-4">
            <span className="text-xs text-muted-foreground">Results</span>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    );
    expect(screen.container).toMatchSnapshot();
  });

  it("withHandle", () => {
    const screen = render(
      <ResizablePanelGroup
        className="min-h-48 max-w-lg rounded-lg border"
        orientation="horizontal"
      >
        <ResizablePanel defaultSize={30}>
          <div className="flex h-full items-center justify-center p-4">
            <span className="text-xs text-muted-foreground">Left</span>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={70}>
          <div className="flex h-full items-center justify-center p-4">
            <span className="text-xs text-muted-foreground">Right</span>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    );
    expect(screen.container).toMatchSnapshot();
  });

  it("threePanels", () => {
    const screen = render(
      <ResizablePanelGroup
        className="min-h-48 max-w-lg rounded-lg border"
        orientation="horizontal"
      >
        <ResizablePanel defaultSize={25} minSize={15}>
          <div className="flex h-full items-center justify-center p-4">
            <span className="text-xs text-muted-foreground">Tables</span>
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={50}>
          <div className="flex h-full items-center justify-center p-4">
            <span className="text-xs text-muted-foreground">Query</span>
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={25} minSize={15}>
          <div className="flex h-full items-center justify-center p-4">
            <span className="text-xs text-muted-foreground">AI</span>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    );
    expect(screen.container).toMatchSnapshot();
  });
});
