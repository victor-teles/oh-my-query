import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

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

const makeActions = () => ({
  onCheckTtl: vi.fn(),
  onCheckType: vi.fn(),
  onCopyName: vi.fn(),
  onInspect: vi.fn(),
  onRequestDelete: vi.fn(),
});

describe("keys-namespace-tree", () => {
  it("default", async () => {
    const onActivateKey = vi.fn();
    const onToggle = vi.fn();
    const screen = render(
      <KeysNamespaceTree
        actions={makeActions()}
        activeRowId={null}
        expanded={sampleExpanded}
        onActivateKey={onActivateKey}
        onToggle={onToggle}
        root={sampleRoot}
      />
    );
    expect(screen.getByText("user")).toBeVisible();
    await expect(screen.getByText("session")).toBeVisible();
    expect(screen.getByTitle("cache:warmup")).toBeVisible();
    expect(screen.container).toMatchSnapshot();
  });

  it("allCollapsed", async () => {
    const onActivateKey = vi.fn();
    const onToggle = vi.fn();
    const screen = render(
      <KeysNamespaceTree
        actions={makeActions()}
        activeRowId={null}
        expanded={new Set<string>()}
        onActivateKey={onActivateKey}
        onToggle={onToggle}
        root={sampleRoot}
      />
    );
    expect(screen.getByText("user")).toBeVisible();
    await screen.getByText("user").click();
    expect(onToggle).toHaveBeenCalledWith("user");
    expect(screen.container).toMatchSnapshot();
  });

  it("keyActivation", async () => {
    const onActivateKey = vi.fn();
    const onToggle = vi.fn();
    const screen = render(
      <KeysNamespaceTree
        actions={makeActions()}
        activeRowId={null}
        expanded={sampleExpanded}
        onActivateKey={onActivateKey}
        onToggle={onToggle}
        root={sampleRoot}
      />
    );
    await screen.getByTitle("cache:warmup").click();
    expect(onActivateKey).toHaveBeenCalledWith("cache:warmup");
    expect(screen.container).toMatchSnapshot();
  });

  it("highlightsActiveRow", () => {
    const onActivateKey = vi.fn();
    const onToggle = vi.fn();
    const screen = render(
      <KeysNamespaceTree
        actions={makeActions()}
        activeRowId="cache:warmup"
        expanded={sampleExpanded}
        onActivateKey={onActivateKey}
        onToggle={onToggle}
        root={sampleRoot}
      />
    );
    expect(screen.getByTitle("cache:warmup")).toBeVisible();
    expect(screen.container).toMatchSnapshot();
  });
});
