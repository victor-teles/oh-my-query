import { TreePine } from "lucide-react";

import type { SyntaxTreeData, TreeNodeData } from "@/hooks/use-syntax-tree";

import { ScrollArea } from "@/components/ui/scroll-area";

import { SyntaxTreeNode } from "./syntax-tree-node";

interface SyntaxTreePanelProps {
  treeData: SyntaxTreeData;
}

function countNodes(node: TreeNodeData): number {
  let count = 1;
  for (const child of node.children) {
    count += countNodes(child);
  }
  return count;
}

export const SyntaxTreePanel = ({ treeData }: SyntaxTreePanelProps) => {
  const nodeCount = treeData.root ? countNodes(treeData.root) : 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <TreePine className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">Syntax Tree</span>
        {nodeCount > 0 && (
          <span className="text-xs text-muted-foreground">
            ({nodeCount} nodes)
          </span>
        )}
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 font-mono text-xs">
          {treeData.root ? (
            <SyntaxTreeNode
              node={treeData.root}
              cursorNodeId={treeData.cursorNodeId}
              depth={0}
            />
          ) : (
            <p className="py-4 text-center text-muted-foreground">
              Type SQL to see the syntax tree
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
