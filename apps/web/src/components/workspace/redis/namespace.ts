import type { RedisKey } from "@/lib/tauri";

export interface NamespaceNode {
  segment: string;
  fullName: string;
  children: NamespaceNode[];
  key: RedisKey | null;
  totalKeys: number;
  depth: number;
}

const createNode = (
  segment: string,
  fullName: string,
  depth: number
): NamespaceNode => ({
  children: [],
  depth,
  fullName,
  key: null,
  segment,
  totalKeys: 0,
});

export const NAMESPACE_SEPARATOR = ":";

const sortNamespace = (n: NamespaceNode): void => {
  n.children.sort((a, b) => {
    const aLeaf = a.children.length === 0;
    const bLeaf = b.children.length === 0;
    if (aLeaf !== bLeaf) {
      return aLeaf ? 1 : -1;
    }
    return a.segment.localeCompare(b.segment);
  });
  for (const c of n.children) {
    sortNamespace(c);
  }
};

export const buildNamespaceTree = (
  keys: RedisKey[],
  separator = NAMESPACE_SEPARATOR
): NamespaceNode => {
  const root = createNode("", "", -1);
  root.totalKeys = keys.length;

  for (const key of keys) {
    const segments = key.name.split(separator);
    let node = root;
    let path = "";

    for (let i = 0; i < segments.length; i += 1) {
      const seg = segments[i] ?? "";
      path = i === 0 ? seg : `${path}${separator}${seg}`;

      let child = node.children.find((c) => c.segment === seg);
      if (!child) {
        child = createNode(seg, path, i);
        node.children.push(child);
      }
      child.totalKeys += 1;

      if (i === segments.length - 1) {
        child.key = key;
      }

      node = child;
    }
  }

  sortNamespace(root);

  return root;
};

export const visibleKeysInOrder = (
  root: NamespaceNode,
  expanded: Set<string>
): RedisKey[] => {
  const keys: RedisKey[] = [];
  const walk = (node: NamespaceNode) => {
    if (node.key) {
      keys.push(node.key);
    }
    if (node.children.length === 0) {
      return;
    }
    const parentIsKey = node.key !== null;
    const isOpen = parentIsKey ? true : expanded.has(node.fullName);
    if (!isOpen) {
      return;
    }
    for (const child of node.children) {
      walk(child);
    }
  };
  for (const child of root.children) {
    walk(child);
  }
  return keys;
};

export type VisibleRow =
  | { kind: "key"; id: string; node: NamespaceNode; key: RedisKey }
  | { kind: "folder"; id: string; node: NamespaceNode };

export const visibleRowsInOrder = (
  root: NamespaceNode,
  expanded: Set<string>
): VisibleRow[] => {
  const rows: VisibleRow[] = [];

  const walk = (node: NamespaceNode) => {
    if (node.key) {
      rows.push({
        id: node.key.name,
        key: node.key,
        kind: "key",
        node,
      });
    } else if (node.children.length > 0) {
      rows.push({
        id: node.fullName,
        kind: "folder",
        node,
      });
    }

    if (node.children.length === 0) {
      return;
    }
    const parentIsKey = node.key !== null;
    const isOpen = parentIsKey ? true : expanded.has(node.fullName);
    if (!isOpen) {
      return;
    }
    for (const child of node.children) {
      walk(child);
    }
  };

  for (const child of root.children) {
    walk(child);
  }

  return rows;
};

export const findParentFullName = (fullName: string): string | null => {
  const idx = fullName.lastIndexOf(NAMESPACE_SEPARATOR);
  if (idx <= 0) {
    return null;
  }
  return fullName.slice(0, idx);
};

export const defaultExpansion = (
  root: NamespaceNode,
  maxAutoExpand = 2
): Set<string> => {
  const expanded = new Set<string>();
  const walk = (node: NamespaceNode, depth: number) => {
    if (depth >= maxAutoExpand) {
      return;
    }
    for (const child of node.children) {
      if (child.children.length > 0) {
        expanded.add(child.fullName);
        walk(child, depth + 1);
      }
    }
  };
  walk(root, 0);
  return expanded;
};
