import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import type { PlanNode } from "@/lib/tauri";

import { PlanNodeDetails } from "./plan-node-details";

const baseNode: PlanNode = {
  children: [],
  cost: { actualTotalMs: 8.4, selfMs: 1.2, startup: 0, total: 100 },
  details: [],
  id: "n0",
  label: "Seq Scan on users",
  nodeType: "Seq Scan",
  rows: { actual: 100, estimated: 50 },
  timing: { actualTotalMs: 8.4, loops: 1, startupMs: 0 },
  warnings: [],
};

describe("plan-node-details", () => {
  it("renders label, type, and core metrics", () => {
    const screen = render(<PlanNodeDetails node={baseNode} />);
    expect(screen.getByText("Seq Scan on users")).toBeVisible();
    expect(screen.getByText("Seq Scan", { exact: true })).toBeVisible();
    expect(screen.getByText("Rows (est.)")).toBeVisible();
    expect(screen.getByText("Rows (actual)")).toBeVisible();
    expect(screen.getByText("Cost (est.)")).toBeVisible();
  });

  it("hides loops when only one loop ran", () => {
    const screen = render(<PlanNodeDetails node={baseNode} />);
    expect(screen.getByText("Loops").query()).toBeNull();
  });

  it("shows loops when greater than one", () => {
    const node: PlanNode = {
      ...baseNode,
      timing: { ...baseNode.timing, loops: 5 },
    };
    const screen = render(<PlanNodeDetails node={node} />);
    expect(screen.getByText("Loops")).toBeVisible();
    expect(screen.getByText("5", { exact: true })).toBeVisible();
  });

  it("renders warnings list when present", () => {
    const node: PlanNode = {
      ...baseNode,
      warnings: ["Sequential scan on large table", "Missing index"],
    };
    const screen = render(<PlanNodeDetails node={node} />);
    expect(screen.getByText("Sequential scan on large table")).toBeVisible();
    expect(screen.getByText("Missing index")).toBeVisible();
  });

  it("renders the details key-value list", () => {
    const node: PlanNode = {
      ...baseNode,
      details: [
        ["Filter", "id > 10"],
        ["Index", "users_pkey"],
      ],
    };
    const screen = render(<PlanNodeDetails node={node} />);
    expect(screen.getByText("Filter")).toBeVisible();
    expect(screen.getByText("id > 10")).toBeVisible();
    expect(screen.getByText("Index")).toBeVisible();
    expect(screen.getByText("users_pkey")).toBeVisible();
  });
});
