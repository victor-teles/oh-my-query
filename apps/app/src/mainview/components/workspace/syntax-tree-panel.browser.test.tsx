import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import type { SyntaxTreeData, TreeNodeData } from "@/hooks/use-syntax-tree";

import { SyntaxTreePanel } from "./syntax-tree-panel";

const makeNode = (
  id: string,
  name: string,
  children: TreeNodeData[] = []
): TreeNodeData => ({
  children,
  from: 0,
  id,
  isError: false,
  name,
  text: "",
  to: 1,
});

describe("syntax-tree-panel", () => {
  it("shows an empty hint when there is no root", () => {
    const data: SyntaxTreeData = { cursorNodeId: null, root: null };
    const screen = render(<SyntaxTreePanel treeData={data} />);
    expect(screen.getByText("Type SQL to see the syntax tree")).toBeVisible();
  });

  it("renders the root node and counts descendants", () => {
    const data: SyntaxTreeData = {
      cursorNodeId: null,
      root: makeNode("0", "Statement", [
        makeNode("0.0", "Select"),
        makeNode("0.1", "From"),
      ]),
    };
    const screen = render(<SyntaxTreePanel treeData={data} />);
    expect(screen.getByText("Syntax Tree")).toBeVisible();
    expect(screen.getByText("(3 nodes)")).toBeVisible();
  });
});
