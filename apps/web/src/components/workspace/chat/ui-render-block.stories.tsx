import type { Meta, StoryObj } from "@storybook/react-vite";

import { expect, userEvent } from "storybook/test";

import { UIRenderBlock } from "./ui-render-block";

const meta = {
  component: UIRenderBlock,
  parameters: { layout: "padded" },
  title: "Workspace/Chat/UIRenderBlock",
} satisfies Meta<typeof UIRenderBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

const validCardSpec = JSON.stringify(
  {
    elements: {
      body: { props: { text: "Database is healthy." }, type: "Text" },
      heading: {
        props: { level: 3, text: "Status" },
        type: "Heading",
      },
      root: {
        children: ["stack"],
        props: {
          description: "All systems operational.",
          title: "System status",
        },
        type: "Card",
      },
      stack: {
        children: ["heading", "body"],
        props: { direction: "vertical", gap: 2 },
        type: "Stack",
      },
    },
    root: "root",
  },
  null,
  2
);

const inlineBadgeSpec = JSON.stringify({
  elements: {
    badge: { props: { text: "12 rows", variant: "secondary" }, type: "Badge" },
  },
  root: "badge",
});

const missingChildSpec = JSON.stringify({
  elements: {
    main: {
      children: ["ghost"],
      props: { title: "Broken card" },
      type: "Card",
    },
  },
  root: "main",
});

const unknownComponentSpec = JSON.stringify({
  elements: {
    main: { props: { label: "Click me" }, type: "Button" },
  },
  root: "main",
});

const partiallyStreamedSpec = '{"root": "main", "elem';

export const ValidCard: Story = {
  args: { code: validCardSpec },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("UI · Card")).toBeVisible();
    await expect(canvas.getByText("Status")).toBeVisible();
    await expect(canvas.getByText("Database is healthy.")).toBeVisible();
  },
};

export const InlineBadge: Story = {
  args: { code: inlineBadgeSpec },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("12 rows")).toBeVisible();
    await expect(canvas.queryByText(/UI · Badge/)).toBeNull();
  },
};

export const ToggleViewSpec: Story = {
  args: { code: validCardSpec },
  play: async ({ canvas }) => {
    const toggle = canvas.getByRole("button", { name: "View raw spec" });
    await userEvent.click(toggle);
    await expect(canvas.getByText(/"root": "root"/)).toBeVisible();
  },
};

export const MissingChild: Story = {
  args: { code: missingChildSpec },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText("UI spec has structural errors")
    ).toBeVisible();
    const reveal = canvas.getByRole("button", { name: "View raw spec" });
    await userEvent.click(reveal);
    await expect(canvas.getByText(/Broken card/)).toBeVisible();
  },
};

export const UnknownComponent: Story = {
  args: { code: unknownComponentSpec },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText("UI spec has structural errors")
    ).toBeVisible();
    await expect(canvas.getByText(/Unknown component "Button"/)).toBeVisible();
  },
};

export const PartialStream: Story = {
  args: { code: partiallyStreamedSpec },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText(/error/i)).toBeNull();
  },
};
