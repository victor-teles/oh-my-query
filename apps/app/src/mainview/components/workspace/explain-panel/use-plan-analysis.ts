import { useMemo } from "react";

import type { PlanNode } from "@/lib/tauri";

export interface PlanAnalysis {
  hotPath: Set<string>;
  maxCost: number;
  totalWarnings: number;
  allNodeIds: string[];
}

const getNodeCost = (node: PlanNode): number => {
  if (node.cost.actualTotalMs !== null) {
    return node.cost.actualTotalMs;
  }
  if (node.cost.total !== null) {
    return node.cost.total;
  }
  return 0;
};

const getSelfCost = (node: PlanNode): number => {
  if (node.cost.selfMs !== null) {
    return node.cost.selfMs;
  }
  return getNodeCost(node);
};

export const computePlanAnalysis = (root: PlanNode): PlanAnalysis => {
  const hotPath = new Set<string>();
  let maxCost = 0;
  let totalWarnings = 0;
  const allNodeIds: string[] = [];

  const collect = (node: PlanNode) => {
    allNodeIds.push(node.id);
    totalWarnings += node.warnings.length;
    const selfCost = getSelfCost(node);
    if (selfCost > maxCost) {
      maxCost = selfCost;
    }
    for (const child of node.children) {
      collect(child);
    }
  };
  collect(root);

  let cursor: PlanNode | undefined = root;
  while (cursor) {
    hotPath.add(cursor.id);
    if (cursor.children.length === 0) {
      break;
    }
    let best: PlanNode | undefined;
    let bestCost = -Infinity;
    for (const child of cursor.children) {
      const cost = getNodeCost(child);
      if (cost > bestCost) {
        bestCost = cost;
        best = child;
      }
    }
    cursor = best;
  }

  return { allNodeIds, hotPath, maxCost, totalWarnings };
};

export const usePlanAnalysis = (root: PlanNode): PlanAnalysis =>
  useMemo(() => computePlanAnalysis(root), [root]);

export const relativeCostFraction = (
  node: PlanNode,
  maxCost: number
): number => {
  if (maxCost <= 0) {
    return 0;
  }
  const selfCost = getSelfCost(node);
  return Math.min(1, Math.max(0, selfCost / maxCost));
};

export const costTier = (fraction: number): "low" | "medium" | "high" => {
  if (fraction >= 0.66) {
    return "high";
  }
  if (fraction >= 0.33) {
    return "medium";
  }
  return "low";
};

const EXPANSION_COST_THRESHOLD = 0.05;

const subtreeCost = (node: PlanNode): number => {
  let sum = getSelfCost(node);
  for (const child of node.children) {
    sum += subtreeCost(child);
  }
  return sum;
};

export const defaultExpandedNodes = (
  root: PlanNode,
  hotPath: Set<string>
): Set<string> => {
  const expanded = new Set<string>();
  const rootSubtree = subtreeCost(root);

  const walk = (node: PlanNode) => {
    expanded.add(node.id);
    for (const child of node.children) {
      const childSubtree = subtreeCost(child);
      const fraction = rootSubtree > 0 ? childSubtree / rootSubtree : 0;
      if (
        hotPath.has(child.id) ||
        fraction >= EXPANSION_COST_THRESHOLD ||
        child.warnings.length > 0
      ) {
        walk(child);
      }
    }
  };
  walk(root);
  return expanded;
};

export interface VisibleNode {
  node: PlanNode;
  depth: number;
  parentId: string | null;
  hasChildren: boolean;
  isExpanded: boolean;
}

export const flattenVisibleNodes = (
  root: PlanNode,
  expanded: Set<string>
): VisibleNode[] => {
  const out: VisibleNode[] = [];
  const walk = (node: PlanNode, depth: number, parentId: string | null) => {
    const isExpanded = expanded.has(node.id);
    out.push({
      depth,
      hasChildren: node.children.length > 0,
      isExpanded,
      node,
      parentId,
    });
    if (isExpanded) {
      for (const child of node.children) {
        walk(child, depth + 1, node.id);
      }
    }
  };
  walk(root, 0, null);
  return out;
};

export const findNodeById = (root: PlanNode, id: string): PlanNode | null => {
  if (root.id === id) {
    return root;
  }
  for (const child of root.children) {
    const found = findNodeById(child, id);
    if (found) {
      return found;
    }
  }
  return null;
};
