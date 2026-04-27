import type { Meta, StoryObj } from "@storybook/react-vite";

import { DatabaseIcon, InboxIcon, SearchIcon } from "lucide-react";
import { expect } from "storybook/test";

import { Button } from "./button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./empty";

const meta = {
  component: Empty,
  title: "UI/Empty",
} satisfies Meta<typeof Empty>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No results")).toBeVisible();
    await expect(
      canvas.getByText(
        "Your query returned no rows. Try adjusting the filters."
      )
    ).toBeVisible();
  },
  render: () => (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <InboxIcon />
        </EmptyMedia>
        <EmptyTitle>No results</EmptyTitle>
        <EmptyDescription>
          Your query returned no rows. Try adjusting the filters.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  ),
};

export const WithAction: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No connections")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Add Connection" })
    ).toBeVisible();
  },
  render: () => (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <DatabaseIcon />
        </EmptyMedia>
        <EmptyTitle>No connections</EmptyTitle>
        <EmptyDescription>
          Get started by adding your first database connection.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm">Add Connection</Button>
      </EmptyContent>
    </Empty>
  ),
};

export const SearchEmpty: Story = {
  render: () => (
    <Empty>
      <EmptyHeader>
        <EmptyMedia>
          <SearchIcon className="size-10 text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle>No matches found</EmptyTitle>
        <EmptyDescription>
          Try a different search term or clear the filter.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  ),
};
