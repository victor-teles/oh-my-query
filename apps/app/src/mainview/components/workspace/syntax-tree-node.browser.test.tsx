import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import type { TreeNodeData } from "@/hooks/use-syntax-tree";

import { SyntaxTreeNode } from "./syntax-tree-node";

const makeNode = (
  id: string,
  name: string,
  text = "",
  children: TreeNodeData[] = [],
  isError = false
): TreeNodeData => ({
  children,
  from: 0,
  id,
  isError,
  name,
  text,
  to: 1,
});

describe("syntax-tree-node", () => {
  it("renders the node name and offset range", () => {
    const node = makeNode("0", "Statement", "SELECT 1");
    const screen = render(
      <SyntaxTreeNode cursorNodeId={null} depth={0} node={node} />
    );
    expect(screen.getByText("Statement")).toBeVisible();
    expect(screen.getByText("[0..1]")).toBeVisible();
  });

  it("truncates long text with an ellipsis", () => {
    const node = makeNode("0", "Long", "x".repeat(80));
    const screen = render(
      <SyntaxTreeNode cursorNodeId={null} depth={0} node={node} />
    );
    expect(screen.getByText(/^x{50}\.\.\.$/)).toBeVisible();
  });

  it("toggles expansion when a node with children is clicked", async () => {
    const node = makeNode("0", "Parent", "", [
      makeNode("0.0", "Child", "leaf"),
    ]);
    const screen = render(
      <SyntaxTreeNode cursorNodeId={null} depth={0} node={node} />
    );
    expect(screen.getByText("Child")).toBeVisible();
    await screen
      .getByRole("button", { name: /Parent/ })
      .first()
      .click();
    expect(screen.getByText("Child").query()).toBeNull();
  });

  it("auto-collapses children at depth >= 2 unless an ancestor of the cursor", () => {
    const node = makeNode("0", "Deep", "", [makeNode("0.0", "Inner", "x")]);
    const screen = render(
      <SyntaxTreeNode cursorNodeId={null} depth={3} node={node} />
    );
    expect(screen.getByText("Inner").query()).toBeNull();
  });
});
