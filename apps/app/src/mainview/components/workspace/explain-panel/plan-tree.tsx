import type { PlanNode } from "@/lib/tauri";

import { cn } from "@/lib/utils";

import { PlanNodeCard } from "./plan-node-card";

interface PlanTreeProps {
  root: PlanNode;
  selectedNodeId: string | null;
  hotPath: Set<string>;
  maxCost: number;
  expanded: Set<string>;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
}

export const PlanTree = ({
  root,
  selectedNodeId,
  hotPath,
  maxCost,
  expanded,
  onSelect,
  onToggleExpand,
}: PlanTreeProps) => (
  <div
    aria-label="Query plan tree"
    className="flex flex-col gap-1 p-3"
    role="tree"
  >
    <PlanTreeNode
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
  selectedNodeId: string | null;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
}

const PlanTreeNode = ({
  node,
  depth,
  maxCost,
  hotPath,
  expanded,
  selectedNodeId,
  onSelect,
  onToggleExpand,
}: PlanTreeNodeProps) => {
  const isExpanded = expanded.has(node.id);
  const isOnHotPath = hotPath.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const hasChildren = node.children.length > 0;

  return (
    <div
      aria-level={depth + 1}
      className={cn(
        "flex flex-col gap-1",
        depth > 0 && "border-l border-border/40 pl-3"
      )}
      role="treeitem"
    >
      <PlanNodeCard
        hasChildren={hasChildren}
        isExpanded={isExpanded}
        isOnHotPath={isOnHotPath}
        isSelected={isSelected}
        maxCost={maxCost}
        node={node}
        onSelect={onSelect}
        onToggleExpand={onToggleExpand}
      />
      {hasChildren && isExpanded && (
        <div className="flex flex-col gap-1" role="group">
          {node.children.map((child) => (
            <PlanTreeNode
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
