import type { RedisKey } from "@/lib/tauri";

import type { NamespaceNode } from "./namespace";

import { KeyContextMenu } from "./key-context-menu";
import { KeyRow } from "./key-row";
import { NAMESPACE_SEPARATOR } from "./namespace";
import { NamespaceRow } from "./namespace-row";

export interface KeyActions {
  onInspect: (key: RedisKey) => void;
  onCheckTtl: (key: RedisKey) => void;
  onCheckType: (key: RedisKey) => void;
  onCopyName: (key: RedisKey) => void;
  onRequestDelete: (key: RedisKey) => void;
}

interface KeysNamespaceTreeProps {
  root: NamespaceNode;
  expanded: Set<string>;
  onToggle: (fullName: string) => void;
  activeRowId: string | null;
  onActivateKey: (name: string) => void;
  actions: KeyActions;
}

export const KeysNamespaceTree = ({
  root,
  expanded,
  onToggle,
  activeRowId,
  onActivateKey,
  actions,
}: KeysNamespaceTreeProps) => {
  const rows: React.ReactNode[] = [];

  const walk = (node: NamespaceNode) => {
    const hasChildren = node.children.length > 0;
    const hasKey = node.key !== null;

    if (hasKey && node.key) {
      const displaySuffix =
        node.fullName.split(NAMESPACE_SEPARATOR).pop() ?? node.fullName;
      const keyEl = (
        <KeyRow
          depth={node.depth}
          displayName={displaySuffix}
          isActive={activeRowId === node.key.name}
          key={`k:${node.fullName}`}
          onActivate={onActivateKey}
          redisKey={node.key}
        />
      );
      rows.push(
        <KeyContextMenu
          key={`kc:${node.fullName}`}
          redisKey={node.key}
          {...actions}
        >
          {keyEl}
        </KeyContextMenu>
      );
    } else if (hasChildren) {
      const isOpen = expanded.has(node.fullName);
      rows.push(
        <NamespaceRow
          depth={node.depth}
          fullName={node.fullName}
          isActive={activeRowId === node.fullName}
          isExpanded={isOpen}
          key={`n:${node.fullName}`}
          keyCount={node.totalKeys}
          onToggle={onToggle}
          segment={node.segment}
        />
      );
      if (!isOpen) {
        return;
      }
    }

    if (hasChildren) {
      for (const child of node.children) {
        walk(child);
      }
    }
  };

  for (const child of root.children) {
    walk(child);
  }

  return <div className="flex flex-col">{rows}</div>;
};
