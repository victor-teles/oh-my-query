import type { ExplainDensity } from "@/lib/query-types";
import type { PlanNode } from "@/lib/tauri";

import { cn } from "@/lib/utils";

import { PlanNodeCard } from "./plan-node-card";

interface PlanTreeProps {
  root: PlanNode;
  selectedNodeId: string | null;
  hotPath: Set<string>;
  maxCost: number;
  expanded: Set<string>;
  density: ExplainDensity;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
}

export const PlanTree = ({
  root,
  selectedNodeId,
  hotPath,
  maxCost,
  expanded,
  density,
  onSelect,
  onToggleExpand,
}: PlanTreeProps) => (
  <div
    aria-label="Query plan tree"
    className={cn(
      "flex flex-col p-3",
      density === "compact" ? "gap-px" : "gap-0.5"
    )}
    role="tree"
  >
    <PlanTreeNode
      density={density}
      depth={0}
      expanded={expanded}
      hotPath={hotPath}
      maxCost={maxCost}
      node={root}
      onSelect={onSelect}
      onToggleExpand={onToggleExpand}
      selectedNodeId={selectedNodeId}
    />
  </div>
);

interface PlanTreeNodeProps {
  node: PlanNode;
  depth: number;
  maxCost: number;
  hotPath: Set<string>;
  expanded: Set<string>;
  density: ExplainDensity;
  selectedNodeId: string | null;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
}

const RAIL_INDENT_PX = 14;

const PlanTreeNode = ({
  node,
  depth,
  maxCost,
  hotPath,
  expanded,
  density,
  selectedNodeId,
  onSelect,
  onToggleExpand,
}: PlanTreeNodeProps) => {
  const isExpanded = expanded.has(node.id);
  const isOnHotPath = hotPath.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const hasChildren = node.children.length > 0;
  const isHotPathLeaf =
    isOnHotPath && !node.children.some((child) => hotPath.has(child.id));

  return (
    <div
      aria-level={depth + 1}
      aria-selected={isSelected}
      className={cn(
        "relative flex flex-col",
        density === "compact" ? "gap-px" : "gap-0.5"
      )}
      role="treeitem"
      style={depth > 0 ? { paddingLeft: RAIL_INDENT_PX } : undefined}
    >
      {depth > 0 && <IndentRail isOnHotPath={isOnHotPath} />}
      <PlanNodeCard
        density={density}
        hasChildren={hasChildren}
        isExpanded={isExpanded}
        isHotPathLeaf={isHotPathLeaf}
        isOnHotPath={isOnHotPath}
        isSelected={isSelected}
        maxCost={maxCost}
        node={node}
        onSelect={onSelect}
        onToggleExpand={onToggleExpand}
      />
      {hasChildren && isExpanded && (
        <div
          className={cn(
            "flex flex-col",
            density === "compact" ? "gap-px" : "gap-0.5"
          )}
          role="group"
        >
          {node.children.map((child) => (
            <PlanTreeNode
              density={density}
              depth={depth + 1}
              expanded={expanded}
              hotPath={hotPath}
              key={child.id}
              maxCost={maxCost}
              node={child}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              selectedNodeId={selectedNodeId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const IndentRail = ({ isOnHotPath }: { isOnHotPath: boolean }) => (
  <span
    aria-hidden="true"
    className={cn(
      "pointer-events-none absolute top-0 bottom-0 left-[5px] w-px",
      isOnHotPath ? "bg-warning/40" : "bg-border/40"
    )}
  />
);
