import type { Meta, StoryObj } from "@storybook/react-vite";

import { expect, within } from "storybook/test";

import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card";

const meta = {
  component: HoverCard,
  title: "UI/HoverCard",
} satisfies Meta<typeof HoverCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText("public.users")).toBeInTheDocument();
  },
  render: () => (
    <HoverCard defaultOpen>
      <HoverCardTrigger
        render={
          <span className="cursor-pointer text-xs underline underline-offset-4">
            users
          </span>
        }
      />
      <HoverCardContent>
        <div className="space-y-1">
          <h4 className="text-sm font-medium">public.users</h4>
          <p className="text-xs text-muted-foreground">
            12 columns &middot; 1,482 rows
          </p>
          <p className="text-xs text-muted-foreground">
            Primary key: id (uuid)
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  ),
};
