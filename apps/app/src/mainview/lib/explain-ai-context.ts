import type { ExplainResult, PlanNode } from "@/lib/tauri";

import { computePlanAnalysis } from "@/components/workspace/explain-panel/use-plan-analysis";

const MAX_HOT_NODES = 8;

const getEffectiveCost = (node: PlanNode): number => {
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
  if (node.cost.total !== null) {
    const childrenTotal = node.children.reduce(
      (sum, c) => sum + (c.cost.total ?? 0),
      0
    );
    return Math.max(0, node.cost.total - childrenTotal);
  }
  return 0;
};

const collectAll = (root: PlanNode): PlanNode[] => {
  const out: PlanNode[] = [];
  const walk = (n: PlanNode) => {
    out.push(n);
    for (const c of n.children) {
      walk(c);
    }
  };
  walk(root);
  return out;
};

const fmtCost = (n: number): string => {
  if (n < 1) {
    return `${(n * 1000).toFixed(0)}µs`;
  }
  if (n < 1000) {
    return `${n.toFixed(2)}ms`;
  }
  return `${(n / 1000).toFixed(2)}s`;
};

export const formatExplainContext = (
  result: ExplainResult,
  sql: string
): string => {
  const analysis = computePlanAnalysis(result.root);
  const allNodes = collectAll(result.root);

  const rootCost = getEffectiveCost(result.root);

  const topNodes = [...allNodes]
    .filter((n) => getSelfCost(n) > 0)
    .toSorted((a, b) => getSelfCost(b) - getSelfCost(a))
    .slice(0, MAX_HOT_NODES);

  const lines: string[] = [
    "## EXPLAIN plan",
    `Engine: ${result.engine}`,
    `Mode: ${result.analyzeRan ? "EXPLAIN ANALYZE (actual timings)" : "EXPLAIN (estimated costs only)"}`,
    `Total execution time: ${fmtCost(result.executionTimeMs)}`,
    "",
    "## Query",
    "```sql",
    sql.trim(),
    "```",
    "",
    "## Costliest nodes (self cost, descending)",
  ];

  for (const node of topNodes) {
    const self = getSelfCost(node);
    const pct =
      rootCost > 0 ? `${((self / rootCost) * 100).toFixed(1)}%` : "?%";
    const isHot = analysis.hotPath.has(node.id);
    const flag = isHot ? " [hot-path]" : "";

    lines.push(`- **${node.label}** (${node.nodeType})${flag}`);

    if (node.cost.actualTotalMs !== null) {
      lines.push(`  actual self time: ${fmtCost(self)} (${pct} of total)`);
    } else if (node.cost.total !== null) {
      lines.push(`  estimated cost unit: ${self.toFixed(2)} (${pct} of total)`);
    }
    if (node.rows.estimated !== null && node.rows.actual !== null) {
      lines.push(
        `  rows: estimated ${node.rows.estimated}, actual ${node.rows.actual}`
      );
      if (node.rows.actual > node.rows.estimated * 10) {
        lines.push("  ⚠ row estimate off by >10×");
      }
    } else if (node.rows.estimated !== null) {
      lines.push(`  estimated rows: ${node.rows.estimated}`);
    }
    if (node.warnings.length > 0) {
      lines.push(`  warnings: ${node.warnings.join(", ")}`);
    }
  }

  const warnNodes = allNodes.filter((n) => n.warnings.length > 0);
  if (warnNodes.length > 0) {
    lines.push("", "## Nodes with warnings");
    for (const n of warnNodes) {
      lines.push(`- ${n.label}: ${n.warnings.join(", ")}`);
    }
  }

  return lines.join("\n");
};
