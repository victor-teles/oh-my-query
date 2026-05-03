import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { PlanNode } from "@/lib/tauri";

import { PlanTree } from "./plan-tree";

const leaf = (id: string, label: string, cost: number): PlanNode => ({
  children: [],
  cost: { actualTotalMs: cost, selfMs: cost, startup: null, total: null },
  details: [],
  id,
  label,
  nodeType: "Scan",
  rows: { actual: null, estimated: null },
  timing: { actualTotalMs: cost, loops: 1, startupMs: null },
  warnings: [],
});

const branchy: PlanNode = {
  children: [leaf("r.0", "scan_users", 2), leaf("r.1", "scan_orders", 5)],
  cost: { actualTotalMs: 7, selfMs: 0, startup: null, total: null },
  details: [],
  id: "r",
  label: "hash_join",
  nodeType: "Hash Join",
  rows: { actual: null, estimated: null },
  timing: { actualTotalMs: 7, loops: 1, startupMs: null },
  warnings: [],
};

const renderTree = (
  selectedNodeId = "r",
  expanded = new Set<string>(["r", "r.0", "r.1"])
) =>
  render(
    <PlanTree
      expanded={expanded}
      hotPath={new Set<string>(["r", "r.1"])}
      maxCost={5}
      onSelect={vi.fn()}
      onToggleExpand={vi.fn()}
      root={branchy}
      selectedNodeId={selectedNodeId}
    />
  );

describe("planTree", () => {
  it("renders root and all expanded children", () => {
    const screen = renderTree();
    expect(screen.getByText("hash_join")).toBeInTheDocument();
    expect(screen.getByText("scan_users")).toBeInTheDocument();
    expect(screen.getByText("scan_orders")).toBeInTheDocument();
  });

  it("hides children of collapsed parent", () => {
    const screen = renderTree("r", new Set<string>(["r.0", "r.1"]));
    expect(screen.getByText("hash_join")).toBeInTheDocument();
    expect(screen.getByText("scan_users").query()).toBeNull();
  });

  it("calls onSelect when a node's button is clicked", async () => {
    const onSelect = vi.fn();
    const screen = render(
      <PlanTree
        expanded={new Set<string>(["r"])}
        hotPath={new Set<string>()}
        maxCost={5}
        onSelect={onSelect}
        onToggleExpand={vi.fn()}
        root={branchy}
        selectedNodeId={null}
      />
    );
    await screen.getByRole("button", { name: /scan_users/i }).click();
    expect(onSelect).toHaveBeenCalledWith("r.0");
  });

  it("calls onToggleExpand when the chevron is clicked", async () => {
    const onToggleExpand = vi.fn();
    const screen = render(
      <PlanTree
        expanded={new Set<string>(["r"])}
        hotPath={new Set<string>()}
        maxCost={5}
        onSelect={vi.fn()}
        onToggleExpand={onToggleExpand}
        root={branchy}
        selectedNodeId={null}
      />
    );
    await screen.getByRole("button", { name: /collapse/i }).click();
    expect(onToggleExpand).toHaveBeenCalledWith("r");
  });

  it("exposes tree semantics for assistive technology", () => {
    const screen = renderTree();
    expect(screen.getByRole("tree")).toBeInTheDocument();
    expect(
      screen.container.querySelectorAll('[role="treeitem"]').length
    ).toBeGreaterThan(0);
  });
});
