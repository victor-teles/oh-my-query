import type { Meta, StoryObj } from "@storybook/react-vite";

import { expect } from "storybook/test";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./resizable";

const meta = {
  component: ResizablePanelGroup,
  title: "UI/Resizable",
} satisfies Meta<typeof ResizablePanelGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Sidebar")).toBeVisible();
    await expect(canvas.getByText("Content")).toBeVisible();
  },
  render: () => (
    <ResizablePanelGroup
      direction="horizontal"
      className="min-h-48 max-w-lg rounded-lg border"
    >
      <ResizablePanel defaultSizePercentage={30} minSizePercentage={20}>
        <div className="flex h-full items-center justify-center p-4">
          <span className="text-xs text-muted-foreground">Sidebar</span>
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSizePercentage={70}>
        <div className="flex h-full items-center justify-center p-4">
          <span className="text-xs text-muted-foreground">Content</span>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  ),
};

export const Vertical: Story = {
  render: () => (
    <ResizablePanelGroup
      direction="vertical"
      className="min-h-64 max-w-lg rounded-lg border"
    >
      <ResizablePanel defaultSizePercentage={60}>
        <div className="flex h-full items-center justify-center p-4">
          <span className="text-xs text-muted-foreground">Editor</span>
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSizePercentage={40}>
        <div className="flex h-full items-center justify-center p-4">
          <span className="text-xs text-muted-foreground">Results</span>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  ),
};

export const WithHandle: Story = {
  render: () => (
    <ResizablePanelGroup
      direction="horizontal"
      className="min-h-48 max-w-lg rounded-lg border"
    >
      <ResizablePanel defaultSizePercentage={30}>
        <div className="flex h-full items-center justify-center p-4">
          <span className="text-xs text-muted-foreground">Left</span>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSizePercentage={70}>
        <div className="flex h-full items-center justify-center p-4">
          <span className="text-xs text-muted-foreground">Right</span>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  ),
};

export const ThreePanels: Story = {
  render: () => (
    <ResizablePanelGroup
      direction="horizontal"
      className="min-h-48 max-w-lg rounded-lg border"
    >
      <ResizablePanel defaultSizePercentage={25} minSizePercentage={15}>
        <div className="flex h-full items-center justify-center p-4">
          <span className="text-xs text-muted-foreground">Tables</span>
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSizePercentage={50}>
        <div className="flex h-full items-center justify-center p-4">
          <span className="text-xs text-muted-foreground">Query</span>
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSizePercentage={25} minSizePercentage={15}>
        <div className="flex h-full items-center justify-center p-4">
          <span className="text-xs text-muted-foreground">AI</span>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  ),
};
