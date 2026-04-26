import type { Meta, StoryObj } from "@storybook/react-vite";

import { ChevronsUpDownIcon } from "lucide-react";
import { expect, userEvent } from "storybook/test";

import { Button } from "./button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./collapsible";

const meta = {
  component: Collapsible,
  title: "UI/Collapsible",
} satisfies Meta<typeof Collapsible>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("users")).toBeVisible();
    await expect(canvas.queryByText("orders")).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "Toggle" }));
    await expect(canvas.getByText("orders")).toBeVisible();
    await expect(canvas.getByText("products")).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: "Toggle" }));
  },
  render: () => (
    <Collapsible className="w-72 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Tables</span>
        <CollapsibleTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="Toggle">
              <ChevronsUpDownIcon />
            </Button>
          }
        />
      </div>
      <div className="rounded-md border px-3 py-2 text-xs">users</div>
      <CollapsibleContent className="space-y-2">
        <div className="rounded-md border px-3 py-2 text-xs">orders</div>
        <div className="rounded-md border px-3 py-2 text-xs">products</div>
      </CollapsibleContent>
    </Collapsible>
  ),
};

export const DefaultOpen: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("name")).toBeVisible();
    await expect(canvas.getByText("email")).toBeVisible();
  },
  render: () => (
    <Collapsible defaultOpen className="w-72 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Columns</span>
        <CollapsibleTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="Toggle columns">
              <ChevronsUpDownIcon />
            </Button>
          }
        />
      </div>
      <div className="rounded-md border px-3 py-2 text-xs">id</div>
      <CollapsibleContent className="space-y-2">
        <div className="rounded-md border px-3 py-2 text-xs">name</div>
        <div className="rounded-md border px-3 py-2 text-xs">email</div>
      </CollapsibleContent>
    </Collapsible>
  ),
};
