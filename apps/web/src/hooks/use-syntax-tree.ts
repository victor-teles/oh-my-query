import type { ViewUpdate } from "@codemirror/view";

import { syntaxTree } from "@codemirror/language";
import { useCallback, useRef, useState } from "react";

export interface TreeNodeData {
  id: string;
  name: string;
  from: number;
  to: number;
  text: string;
  isError: boolean;
  children: TreeNodeData[];
}

export interface SyntaxTreeData {
  root: TreeNodeData | null;
  cursorNodeId: string | null;
}

const EMPTY_TREE: SyntaxTreeData = { cursorNodeId: null, root: null };
const DEBOUNCE_MS = 150;

function extractTreeData(
  tree: { cursor: () => TreeCursorLike },
  doc: { sliceString: (from: number, to: number) => string }
): TreeNodeData {
  const treeCursor = tree.cursor();

  function buildNode(parentPath: string, index: number): TreeNodeData {
    const id = parentPath ? `${parentPath}.${index}` : String(index);
    const node: TreeNodeData = {
      children: [],
      from: treeCursor.from,
      id,
      isError: treeCursor.type.isError,
      name: treeCursor.name,
      text: doc.sliceString(
        treeCursor.from,
        Math.min(treeCursor.to, treeCursor.from + 80)
      ),
      to: treeCursor.to,
    };

    if (treeCursor.firstChild()) {
      let childIndex = 0;
      do {
        node.children.push(buildNode(id, childIndex));
        childIndex += 1;
      } while (treeCursor.nextSibling());
      treeCursor.parent();
    }

    return node;
  }

  return buildNode("", 0);
}

function findCursorNodeId(
  root: TreeNodeData,
  cursorPos: number
): string | null {
  let result: string | null = null;

  function walk(node: TreeNodeData): void {
    if (cursorPos >= node.from && cursorPos <= node.to) {
      result = node.id;
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  walk(root);
  return result;
}

interface TreeCursorLike {
  name: string;
  from: number;
  to: number;
  type: { isError: boolean };
  firstChild: () => boolean;
  nextSibling: () => boolean;
  parent: () => boolean;
}

export function useSyntaxTree(enabled: boolean) {
  const [treeData, setTreeData] = useState<SyntaxTreeData>(EMPTY_TREE);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEditorUpdate = useCallback(
    (update: ViewUpdate) => {
      if (!enabled) {
        return;
      }

      const process = () => {
        const tree = syntaxTree(update.state);
        const { doc } = update.state;
        const root = extractTreeData(tree, doc);
        const cursorPos = update.state.selection.main.head;
        const cursorNodeId = findCursorNodeId(root, cursorPos);
        setTreeData({ cursorNodeId, root });
      };

      if (update.docChanged) {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(process, DEBOUNCE_MS);
      } else if (update.selectionSet) {
        process();
      }
    },
    [enabled]
  );

  return { handleEditorUpdate, treeData: enabled ? treeData : EMPTY_TREE };
}
