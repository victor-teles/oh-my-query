import type { PlanNode } from "./explain.ts";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [k: string]: JsonValue };

function newNode(id: string, nodeType: string, label: string): PlanNode {
  return {
    children: [],
    cost: { actualTotalMs: null, selfMs: null, startup: null, total: null },
    details: [],
    id,
    label,
    nodeType,
    rows: { actual: null, estimated: null },
    timing: { actualTotalMs: null, loops: null, startupMs: null },
    warnings: [],
  };
}

function asNum(v: JsonValue | undefined): number | null {
  if (typeof v === "number") {
    return Number.isFinite(v) ? v : null;
  }
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asString(v: JsonValue | undefined): string | null {
  return typeof v === "string" ? v : null;
}

function buildLabel(
  nodeType: string,
  relation: string | null,
  index: string | null,
  alias: string | null
): string {
  const target = relation ?? index;
  if (target && alias && alias !== target) {
    return `${nodeType} on ${target} (${alias})`;
  }
  if (target) {
    return `${nodeType} on ${target}`;
  }
  return nodeType;
}

const SKIP_KEYS = new Set([
  "Plans",
  "Plan",
  "children",
  "nested_loop",
  "query_block",
]);

function copySimpleFields(target: [string, string][], node: JsonValue): void {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return;
  }
  for (const [k, v] of Object.entries(node)) {
    if (SKIP_KEYS.has(k)) {
      continue;
    }
    if (v === null) {
      continue;
    }
    if (typeof v === "string") {
      target.push([k, v]);
      continue;
    }
    if (typeof v === "number" || typeof v === "boolean") {
      target.push([k, String(v)]);
      continue;
    }
    const pretty = JSON.stringify(v);
    if (pretty.length <= 120) {
      target.push([k, pretty]);
    }
  }
}

function flagWarnings(plan: PlanNode): void {
  if (plan.nodeType.toLowerCase() === "seq scan") {
    plan.warnings.push("Sequential scan");
  }
  if (plan.nodeType === "Full Table Scan") {
    plan.warnings.push("Full table scan");
  }
  const { estimated, actual } = plan.rows;
  if (estimated !== null && actual !== null && estimated > 0 && actual > 0) {
    const ratio = Math.max(actual / estimated, estimated / actual);
    if (ratio > 10) {
      plan.warnings.push(`Row estimate off by ${ratio.toFixed(0)}×`);
    }
  }
  if (
    plan.details.some(([k, v]) => k === "Sort Method" && v.includes("disk"))
  ) {
    plan.warnings.push("Disk sort");
  }
}

export function parsePostgres(rootJson: JsonValue): PlanNode {
  let rootPlan: JsonValue | undefined;
  if (Array.isArray(rootJson)) {
    const [first] = rootJson;
    if (first && typeof first === "object" && !Array.isArray(first)) {
      rootPlan = (first as Record<string, JsonValue>).Plan;
    }
  } else if (rootJson && typeof rootJson === "object") {
    rootPlan = (rootJson as Record<string, JsonValue>).Plan;
  }
  if (!rootPlan) {
    throw new Error("PostgreSQL EXPLAIN output missing Plan");
  }
  return parsePgNode(rootPlan, "p");
}

function parsePgNode(node: JsonValue, id: string): PlanNode {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return newNode(id, "Unknown", "Unknown");
  }
  const obj = node as Record<string, JsonValue>;
  const nodeType = asString(obj["Node Type"]) ?? "Unknown";
  const relation = asString(obj["Relation Name"]);
  const index = asString(obj["Index Name"]);
  const alias = asString(obj["Alias"]);
  const label = buildLabel(nodeType, relation, index, alias);

  const plan = newNode(id, nodeType, label);
  plan.cost.startup = asNum(obj["Startup Cost"]);
  plan.cost.total = asNum(obj["Total Cost"]);
  plan.rows.estimated = asNum(obj["Plan Rows"]);
  plan.rows.actual = asNum(obj["Actual Rows"]);

  const actualTotal = asNum(obj["Actual Total Time"]);
  const loops = asNum(obj["Actual Loops"]) ?? 1;
  if (actualTotal !== null) {
    const totalMs = actualTotal * loops;
    plan.timing.actualTotalMs = totalMs;
    plan.timing.loops = loops;
    plan.cost.actualTotalMs = totalMs;
    plan.cost.selfMs = totalMs;
  }
  plan.timing.startupMs = asNum(obj["Actual Startup Time"]);

  copySimpleFields(plan.details, node);

  const plans = obj["Plans"];
  if (Array.isArray(plans)) {
    let childrenTotal = 0;
    for (let i = 0; i < plans.length; i += 1) {
      const childPlan = parsePgNode(plans[i] as JsonValue, `${id}.${i}`);
      if (childPlan.cost.actualTotalMs !== null) {
        childrenTotal += childPlan.cost.actualTotalMs;
        childPlan.cost.selfMs ??= childPlan.cost.actualTotalMs;
      }
      plan.children.push(childPlan);
    }
    if (plan.cost.actualTotalMs !== null) {
      plan.cost.selfMs = Math.max(plan.cost.actualTotalMs - childrenTotal, 0);
    }
  }

  flagWarnings(plan);
  return plan;
}

export function parseMysql(rootJson: JsonValue): PlanNode {
  if (!rootJson || typeof rootJson !== "object" || Array.isArray(rootJson)) {
    throw new Error("MySQL EXPLAIN output missing query_block");
  }
  const queryBlock = (rootJson as Record<string, JsonValue>).query_block;
  if (queryBlock === null) {
    throw new Error("MySQL EXPLAIN output missing query_block");
  }
  return parseMysqlBlock(queryBlock, "m");
}

function parseMysqlBlock(node: JsonValue, id: string): PlanNode {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return newNode(id, "Query Block", "Query Block");
  }
  const obj = node as Record<string, JsonValue>;
  if (obj.table) {
    return parseMysqlTable(obj.table, id);
  }

  const nestedKey = (
    ["nested_loop", "ordering_operation", "grouping_operation"] as const
  ).find((k) => obj[k] !== null);

  let nodeType = "Query Block";
  if (nestedKey === "nested_loop") {
    nodeType = "Nested Loop";
  } else if (nestedKey === "ordering_operation") {
    nodeType = "Ordering";
  } else if (nestedKey === "grouping_operation") {
    nodeType = "Grouping";
  }

  const plan = newNode(id, nodeType, nodeType);

  const costInfo = obj.cost_info;
  if (costInfo && typeof costInfo === "object" && !Array.isArray(costInfo)) {
    plan.cost.total = asNum((costInfo as Record<string, JsonValue>).query_cost);
  }
  plan.rows.estimated = asNum(obj.rows_produced_per_join);
  copySimpleFields(plan.details, node);

  if (nestedKey && Array.isArray(obj[nestedKey])) {
    const arr = obj[nestedKey] as JsonValue[];
    for (let i = 0; i < arr.length; i += 1) {
      plan.children.push(parseMysqlBlock(arr[i] as JsonValue, `${id}.${i}`));
    }
  } else {
    const inner = obj.ordering_operation ?? obj.grouping_operation;
    if (inner) {
      plan.children.push(parseMysqlBlock(inner, `${id}.0`));
    }
  }

  flagWarnings(plan);
  return plan;
}

function parseMysqlTable(table: JsonValue, id: string): PlanNode {
  const obj =
    table && typeof table === "object" && !Array.isArray(table)
      ? (table as Record<string, JsonValue>)
      : {};
  const accessType = asString(obj.access_type) ?? "table";
  const tableName = asString(obj.table_name) ?? "?";
  let nodeType: string;
  if (accessType === "ALL") {
    nodeType = "Full Table Scan";
  } else if (accessType === "index") {
    nodeType = "Full Index Scan";
  } else if (accessType === "range") {
    nodeType = "Range Scan";
  } else if (accessType === "ref") {
    nodeType = "Ref Scan";
  } else if (accessType === "const" || accessType === "eq_ref") {
    nodeType = "Const Scan";
  } else {
    nodeType = `${accessType} Scan`;
  }

  const label = `${nodeType} on ${tableName}`;
  const plan = newNode(id, nodeType, label);

  const costInfo = obj.cost_info;
  if (costInfo && typeof costInfo === "object" && !Array.isArray(costInfo)) {
    plan.cost.total = asNum((costInfo as Record<string, JsonValue>).read_cost);
  }
  plan.rows.estimated = asNum(obj.rows_examined_per_scan);
  copySimpleFields(plan.details, table);
  flagWarnings(plan);
  return plan;
}

export function parseClickhouse(rootJson: JsonValue): PlanNode {
  let rootPlan: JsonValue | undefined;
  if (Array.isArray(rootJson)) {
    const [first] = rootJson;
    if (first && typeof first === "object" && !Array.isArray(first)) {
      rootPlan = (first as Record<string, JsonValue>).Plan ?? first;
    }
  } else if (rootJson && typeof rootJson === "object") {
    rootPlan = (rootJson as Record<string, JsonValue>).Plan ?? rootJson;
  } else {
    throw new Error("Unexpected ClickHouse EXPLAIN shape");
  }
  if (!rootPlan) {
    throw new Error("ClickHouse EXPLAIN empty");
  }
  return parseChNode(rootPlan, "c");
}

function parseChNode(node: JsonValue, id: string): PlanNode {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return newNode(id, "Unknown", "Unknown");
  }
  const obj = node as Record<string, JsonValue>;
  const nodeType = asString(obj["Node Type"]) ?? "Unknown";
  const description = asString(obj["Description"]) ?? "";
  const label = description ? `${nodeType} — ${description}` : nodeType;
  const plan = newNode(id, nodeType, label);
  copySimpleFields(plan.details, node);

  const plans = obj["Plans"];
  if (Array.isArray(plans)) {
    for (let i = 0; i < plans.length; i += 1) {
      plan.children.push(parseChNode(plans[i] as JsonValue, `${id}.${i}`));
    }
  }
  flagWarnings(plan);
  return plan;
}

export function parseDuckdb(rootJson: JsonValue): PlanNode {
  let root: JsonValue | undefined = rootJson;
  if (Array.isArray(rootJson)) {
    [root] = rootJson;
  }
  if (root === null) {
    throw new Error("DuckDB EXPLAIN empty");
  }
  return parseDuckNode(root, "d");
}

function parseDuckNode(node: JsonValue, id: string): PlanNode {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return newNode(id, "Unknown", "Unknown");
  }
  const obj = node as Record<string, JsonValue>;
  const nodeType =
    asString(obj.name) ?? asString(obj.operator_type) ?? "Unknown";
  const extraRaw = asString(obj.extra_info);
  const extra = extraRaw ? extraRaw.split("\n")[0] : null;
  const label = extra ? `${nodeType} — ${extra}` : nodeType;

  const plan = newNode(id, nodeType, label);
  plan.rows.estimated =
    asNum(obj.operator_cardinality) ?? asNum(obj.cardinality);

  const timing = asNum(obj.operator_timing);
  if (timing !== null) {
    const ms = timing * 1000;
    plan.timing.actualTotalMs = ms;
    plan.cost.actualTotalMs = ms;
    plan.cost.selfMs = ms;
  }

  copySimpleFields(plan.details, node);

  const { children } = obj;
  if (Array.isArray(children)) {
    let childrenTotal = 0;
    for (let i = 0; i < children.length; i += 1) {
      const childPlan = parseDuckNode(children[i] as JsonValue, `${id}.${i}`);
      if (childPlan.cost.actualTotalMs !== null) {
        childrenTotal += childPlan.cost.actualTotalMs;
        childPlan.cost.selfMs ??= childPlan.cost.actualTotalMs;
      }
      plan.children.push(childPlan);
    }
    if (plan.cost.actualTotalMs !== null) {
      plan.cost.selfMs = Math.max(plan.cost.actualTotalMs - childrenTotal, 0);
    }
  }

  flagWarnings(plan);
  return plan;
}
