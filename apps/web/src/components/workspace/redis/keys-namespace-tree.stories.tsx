import type { Meta, StoryObj } from "@storybook/react-vite";

import { expect, fn, userEvent } from "storybook/test";

import type { RedisKey } from "@/lib/tauri";

import { KeysNamespaceTree } from "./keys-namespace-tree";
import { buildNamespaceTree, defaultExpansion } from "./namespace";

const makeKey = (name: string): RedisKey => ({
  kind: "STRING",
  name,
  size: 1,
  sizeUnit: "bytes",
  ttlSecs: null,
});

const sampleKeys: RedisKey[] = [
  makeKey("user:1:profile"),
  makeKey("user:1:settings"),
  makeKey("user:2:profile"),
  makeKey("session:abc123"),
  makeKey("session:xyz789"),
  makeKey("cache:warmup"),
];

const sampleRoot = buildNamespaceTree(sampleKeys);
const sampleExpanded = defaultExpansion(sampleRoot);

const actions = {
  onCheckTtl: fn(),
  onCheckType: fn(),
  onCopyName: fn(),
  onInspect: fn(),
  onRequestDelete: fn(),
};

const meta = {
  args: {
    actions,
    activeRowId: null,
    expanded: sampleExpanded,
    onActivateKey: fn(),
    onToggle: fn(),
    root: sampleRoot,
  },
  component: KeysNamespaceTree,
  title: "Workspace/Redis/KeysNamespaceTree",
} satisfies Meta<typeof KeysNamespaceTree>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("user")).toBeVisible();
    await expect(canvas.getByText("session")).toBeVisible();
    await expect(canvas.getByText("cache:warmup")).toBeVisible();
  },
};

export const AllCollapsed: Story = {
  args: {
    expanded: new Set<string>(),
  },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByText("user")).toBeVisible();
    await userEvent.click(canvas.getByText("user"));
    await expect(args.onToggle).toHaveBeenCalledWith("user");
  },
};

export const KeyActivation: Story = {
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByText("cache:warmup"));
    await expect(args.onActivateKey).toHaveBeenCalledWith("cache:warmup");
  },
};

export const HighlightsActiveRow: Story = {
  args: {
    activeRowId: "cache:warmup",
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("cache:warmup")).toBeVisible();
  },
};
