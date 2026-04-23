import { describe, expect, it } from "vitest";

import type { PlanNode } from "@/lib/tauri";

import {
  computePlanAnalysis,
  costTier,
  defaultExpandedNodes,
  findNodeById,
  flattenVisibleNodes,
  relativeCostFraction,
} from "./use-plan-analysis";

const makeNode = (overrides: Partial<PlanNode>): PlanNode => ({
  children: [],
  cost: {
    actualTotalMs: null,
    selfMs: null,
    startup: null,
    total: null,
  },
  details: [],
  id: "n",
  label: "node",
  nodeType: "Test",
  rows: { actual: null, estimated: null },
  timing: { actualTotalMs: null, loops: null, startupMs: null },
  warnings: [],
  ...overrides,
});

describe("computePlanAnalysis", () => {
  it("picks the max-cost path from root to leaf", () => {
    const leafFast = makeNode({
      cost: { actualTotalMs: 1, selfMs: 1, startup: null, total: null },
      id: "r.0",
    });
    const leafSlow = makeNode({
      cost: { actualTotalMs: 10, selfMs: 10, startup: null, total: null },
      id: "r.1",
    });
    const root = makeNode({
      children: [leafFast, leafSlow],
      cost: { actualTotalMs: 11, selfMs: 0, startup: null, total: null },
      id: "r",
    });

    const analysis = computePlanAnalysis(root);
    expect(analysis.hotPath.has("r")).toBeTruthy();
    expect(analysis.hotPath.has("r.1")).toBeTruthy();
    expect(analysis.hotPath.has("r.0")).toBeFalsy();
  });

  it("counts warnings across the whole tree", () => {
    const root = makeNode({
      children: [
        makeNode({ id: "r.0", warnings: ["a"] }),
        makeNode({ id: "r.1", warnings: ["b", "c"] }),
      ],
      id: "r",
      warnings: [],
    });
    const analysis = computePlanAnalysis(root);
    expect(analysis.totalWarnings).toBe(3);
  });

  it("falls back to estimated cost when actual is absent", () => {
    const root = makeNode({
      cost: { actualTotalMs: null, selfMs: null, startup: null, total: 42 },
      id: "r",
    });
    const analysis = computePlanAnalysis(root);
    expect(analysis.maxCost).toBe(42);
  });
});

describe("relativeCostFraction", () => {
  it("returns 0 when maxCost is 0", () => {
    const node = makeNode({
      cost: {
        actualTotalMs: 100,
        selfMs: 100,
        startup: null,
        total: null,
      },
    });
    expect(relativeCostFraction(node, 0)).toBe(0);
  });

  it("clamps to 1 when cost exceeds max", () => {
    const node = makeNode({
      cost: {
        actualTotalMs: 200,
        selfMs: 200,
        startup: null,
        total: null,
      },
    });
    expect(relativeCostFraction(node, 100)).toBe(1);
  });
});

describe("costTier", () => {
  it("returns low under 0.33", () => {
    expect(costTier(0)).toBe("low");
    expect(costTier(0.32)).toBe("low");
  });

  it("returns medium between 0.33 and 0.66", () => {
    expect(costTier(0.33)).toBe("medium");
    expect(costTier(0.65)).toBe("medium");
  });

  it("returns high above 0.66", () => {
    expect(costTier(0.66)).toBe("high");
    expect(costTier(1)).toBe("high");
  });
});

describe("defaultExpandedNodes", () => {
  it("always expands root", () => {
    const root = makeNode({ id: "r" });
    const expanded = defaultExpandedNodes(root, new Set());
    expect(expanded.has("r")).toBeTruthy();
  });

  it("expands nodes on the hot path even if cheap", () => {
    const cheapHotChild = makeNode({
      cost: { actualTotalMs: 0.1, selfMs: 0.1, startup: null, total: null },
      id: "r.0",
    });
    const root = makeNode({
      children: [cheapHotChild],
      cost: { actualTotalMs: 100, selfMs: 99.9, startup: null, total: null },
      id: "r",
    });
    const expanded = defaultExpandedNodes(root, new Set(["r", "r.0"]));
    expect(expanded.has("r.0")).toBeTruthy();
  });

  it("collapses subtrees under the 5% cost threshold", () => {
    const tinyChild = makeNode({
      cost: { actualTotalMs: 1, selfMs: 1, startup: null, total: null },
      id: "r.0",
    });
    const root = makeNode({
      children: [tinyChild],
      cost: { actualTotalMs: 100, selfMs: 99, startup: null, total: null },
      id: "r",
    });
    const expanded = defaultExpandedNodes(root, new Set(["r"]));
    expect(expanded.has("r")).toBeTruthy();
    expect(expanded.has("r.0")).toBeFalsy();
  });

  it("expands subtrees with warnings even if cheap", () => {
    const warnChild = makeNode({
      cost: { actualTotalMs: 1, selfMs: 1, startup: null, total: null },
      id: "r.0",
      warnings: ["Seq Scan"],
    });
    const root = makeNode({
      children: [warnChild],
      cost: { actualTotalMs: 100, selfMs: 99, startup: null, total: null },
      id: "r",
    });
    const expanded = defaultExpandedNodes(root, new Set(["r"]));
    expect(expanded.has("r.0")).toBeTruthy();
  });
});

describe("flattenVisibleNodes", () => {
  it("returns only expanded nodes in DFS order", () => {
    const child = makeNode({ id: "r.0" });
    const grandchild = makeNode({ id: "r.0.0" });
    child.children.push(grandchild);
    const root = makeNode({ children: [child], id: "r" });

    const visible = flattenVisibleNodes(root, new Set(["r"]));
    expect(visible.map((v) => v.node.id)).toStrictEqual(["r", "r.0"]);
  });

  it("includes grandchildren when their parent is expanded", () => {
    const grandchild = makeNode({ id: "r.0.0" });
    const child = makeNode({ children: [grandchild], id: "r.0" });
    const root = makeNode({ children: [child], id: "r" });

    const visible = flattenVisibleNodes(root, new Set(["r", "r.0"]));
    expect(visible.map((v) => v.node.id)).toStrictEqual(["r", "r.0", "r.0.0"]);
  });

  it("marks depth and parent for each visible node", () => {
    const child = makeNode({ id: "r.0" });
    const root = makeNode({ children: [child], id: "r" });
    const visible = flattenVisibleNodes(root, new Set(["r"]));
    expect(visible[0]).toMatchObject({ depth: 0, parentId: null });
    expect(visible[1]).toMatchObject({ depth: 1, parentId: "r" });
  });
});

describe("findNodeById", () => {
  it("finds the root", () => {
    const root = makeNode({ id: "r" });
    expect(findNodeById(root, "r")).toBe(root);
  });

  it("finds a nested node", () => {
    const target = makeNode({ id: "r.0.1" });
    const child = makeNode({ children: [target], id: "r.0" });
    const root = makeNode({ children: [child], id: "r" });
    expect(findNodeById(root, "r.0.1")).toBe(target);
  });

  it("returns null when the id is missing", () => {
    const root = makeNode({ id: "r" });
    expect(findNodeById(root, "missing")).toBeNull();
  });
});
