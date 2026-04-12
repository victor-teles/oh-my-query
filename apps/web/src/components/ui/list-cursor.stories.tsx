// oxlint-disable react-perf/jsx-no-new-function-as-prop
import type { Meta, StoryObj } from "@storybook/react-vite";

import { useState } from "react";
import { expect, userEvent } from "storybook/test";

import { cn } from "@/lib/utils";

import { ListCursor } from "./list-cursor";

const meta = {
  component: ListCursor,
  title: "UI/ListCursor",
} satisfies Meta<typeof ListCursor>;

export default meta;
type Story = StoryObj<typeof meta>;

const items = ["users", "orders", "products", "categories"];

function ListCursorDemo() {
  const [active, setActive] = useState("users");
  return (
    <nav className="flex flex-col gap-0.5 p-2">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setActive(item)}
          className={cn(
            "relative rounded-md px-3 py-1.5 text-left text-xs transition-colors",
            active === item
              ? "text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {active === item && (
            <ListCursor layoutId="list-cursor-demo" className="inset-0 -z-10" />
          )}
          {item}
        </button>
      ))}
    </nav>
  );
}

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("users")).toBeVisible();
    await userEvent.click(canvas.getByText("products"));
    await expect(canvas.getByText("products")).toBeVisible();
    await userEvent.click(canvas.getByText("orders"));
  },
  render: () => <ListCursorDemo />,
};
