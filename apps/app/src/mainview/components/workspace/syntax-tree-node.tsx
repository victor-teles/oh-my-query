import { ChevronRight } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import type { TreeNodeData } from "@/hooks/use-syntax-tree";

import { cn } from "@/lib/utils";

interface SyntaxTreeNodeProps {
  node: TreeNodeData;
  cursorNodeId: string | null;
  depth: number;
}

const TRUNCATE_LENGTH = 50;

function truncateText(text: string): string {
  if (text.length <= TRUNCATE_LENGTH) {
    return text;
  }
  return `${text.slice(0, TRUNCATE_LENGTH)}...`;
}

export const SyntaxTreeNode = memo(function SyntaxTreeNode({
  node,
  cursorNodeId,
  depth,
}: SyntaxTreeNodeProps) {
  const isCursorNode = cursorNodeId === node.id;
  const isAncestorOfCursor = cursorNodeId
    ? cursorNodeId.startsWith(`${node.id}.`)
    : false;
  const [isExpanded, setIsExpanded] = useState(depth < 2 || isAncestorOfCursor);
  const nodeRef = useRef<HTMLButtonElement>(null);
  const hasChildren = node.children.length > 0;

  useEffect(() => {
    if (isAncestorOfCursor && !isExpanded) {
      setIsExpanded(true);
    }
  }, [isAncestorOfCursor, isExpanded]);

  useEffect(() => {
    if (isCursorNode && nodeRef.current) {
      nodeRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isCursorNode]);

  const handleToggle = useCallback(() => {
    if (hasChildren) {
      setIsExpanded((prev) => !prev);
    }
  }, [hasChildren]);

  return (
    <div>
      <button
        type="button"
        ref={nodeRef}
        className={cn(
          "flex w-full cursor-pointer items-center gap-1 rounded-sm px-1 py-0.5 text-left hover:bg-muted/50",
          isCursorNode && "border-l-2 border-primary bg-primary/10"
        )}
        onClick={handleToggle}
      >
        <span className="flex size-3.5 shrink-0 items-center justify-center">
          {hasChildren && (
            <ChevronRight
              className={cn(
                "size-3 text-muted-foreground transition-transform",
                isExpanded && "rotate-90"
              )}
            />
          )}
        </span>

        <span
          className={cn(
            "font-semibold",
            node.isError ? "text-red-400" : "text-blue-400"
          )}
        >
          {node.name}
        </span>

        <span className="text-muted-foreground">
          [{node.from}..{node.to}]
        </span>

        {node.text && (
          <span className="truncate text-foreground/40">
            {truncateText(node.text)}
          </span>
        )}
      </button>

      {hasChildren && isExpanded && (
        <div className="ml-3 border-l border-border pl-1">
          {node.children.map((child) => (
            <SyntaxTreeNode
              key={child.id}
              node={child}
              cursorNodeId={cursorNodeId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
});
