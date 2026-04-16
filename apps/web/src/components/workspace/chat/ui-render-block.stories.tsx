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
    await expect(canvas.getByText("Status")).toBeVisible();
    await expect(canvas.getByText("Database is healthy.")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Show source" })
    ).toBeInTheDocument();
  },
};

export const InlineBadge: Story = {
  args: { code: inlineBadgeSpec },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("12 rows")).toBeVisible();
  },
};

export const ToggleViewSpec: Story = {
  args: { code: validCardSpec },
  play: async ({ canvas }) => {
    const toggle = canvas.getByRole("button", { name: "Show source" });
    await userEvent.click(toggle);
    await expect(canvas.getByText(/"root": "root"/)).toBeVisible();
  },
};

export const MissingChild: Story = {
  args: { code: missingChildSpec },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Couldn't render this UI")).toBeVisible();
    const reveal = canvas.getByRole("button", { name: "Show source" });
    await userEvent.click(reveal);
    await expect(canvas.getByText(/Broken card/)).toBeVisible();
  },
};

export const UnknownComponent: Story = {
  args: { code: unknownComponentSpec },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Couldn't render this UI")).toBeVisible();
    await expect(canvas.getByText(/Unknown component "Button"/)).toBeVisible();
  },
};

export const PartialStream: Story = {
  args: { code: partiallyStreamedSpec },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText(/error/i)).toBeNull();
  },
};

export const KeyboardActions: Story = {
  args: { code: validCardSpec },
  play: async ({ canvas, step }) => {
    const sourceButton = canvas.getByRole("button", { name: "Show source" });
    await step("focus the card via keyboard", () => {
      sourceButton.focus();
    });
    await step("press s to toggle to source view", async () => {
      await userEvent.keyboard("s");
      await expect(canvas.getByText(/"root": "root"/)).toBeVisible();
    });
    await step("press s again to return to preview", async () => {
      await userEvent.keyboard("s");
      await expect(canvas.getByText("Database is healthy.")).toBeVisible();
    });
  },
};
