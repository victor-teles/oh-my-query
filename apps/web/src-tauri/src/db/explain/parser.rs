use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CostInfo {
    pub startup: Option<f64>,
    pub total: Option<f64>,
    pub actual_total_ms: Option<f64>,
    pub self_ms: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RowInfo {
    pub estimated: Option<f64>,
    pub actual: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TimingInfo {
    pub actual_total_ms: Option<f64>,
    pub loops: Option<f64>,
    pub startup_ms: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanNode {
    pub id: String,
    pub node_type: String,
    pub label: String,
    pub cost: CostInfo,
    pub rows: RowInfo,
    pub timing: TimingInfo,
    pub warnings: Vec<String>,
    pub details: Vec<(String, String)>,
    pub children: Vec<PlanNode>,
}

impl PlanNode {
    fn new(id: String, node_type: String, label: String) -> Self {
        Self {
            id,
            node_type,
            label,
            cost: CostInfo::default(),
            rows: RowInfo::default(),
            timing: TimingInfo::default(),
            warnings: Vec::new(),
            details: Vec::new(),
            children: Vec::new(),
        }
    }
}

pub fn parse_postgres(root_json: &Value) -> Result<PlanNode, String> {
    let root_plan = match root_json {
        Value::Array(arr) => arr
            .first()
            .and_then(|v| v.get("Plan"))
            .ok_or_else(|| "PostgreSQL EXPLAIN output missing Plan".to_string())?,
        Value::Object(obj) => obj
            .get("Plan")
            .ok_or_else(|| "PostgreSQL EXPLAIN output missing Plan".to_string())?,
        _ => return Err("Unexpected PostgreSQL EXPLAIN shape".to_string()),
    };
    Ok(parse_pg_node(root_plan, "p"))
}

fn parse_pg_node(node: &Value, id: &str) -> PlanNode {
    let node_type = node
        .get("Node Type")
        .and_then(Value::as_str)
        .unwrap_or("Unknown")
        .to_string();

    let relation = node.get("Relation Name").and_then(Value::as_str);
    let index = node.get("Index Name").and_then(Value::as_str);
    let alias = node.get("Alias").and_then(Value::as_str);

    let label = build_label(&node_type, relation, index, alias);

    let mut plan = PlanNode::new(id.to_string(), node_type.clone(), label);

    plan.cost.startup = node.get("Startup Cost").and_then(Value::as_f64);
    plan.cost.total = node.get("Total Cost").and_then(Value::as_f64);
    plan.rows.estimated = node.get("Plan Rows").and_then(Value::as_f64);
    plan.rows.actual = node.get("Actual Rows").and_then(Value::as_f64);

    let actual_total = node.get("Actual Total Time").and_then(Value::as_f64);
    let loops = node.get("Actual Loops").and_then(Value::as_f64).unwrap_or(1.0);
    if let Some(t) = actual_total {
        let total_ms = t * loops;
        plan.timing.actual_total_ms = Some(total_ms);
        plan.timing.loops = Some(loops);
        plan.cost.actual_total_ms = Some(total_ms);
        plan.cost.self_ms = Some(total_ms);
    }
    plan.timing.startup_ms = node.get("Actual Startup Time").and_then(Value::as_f64);

    copy_simple_fields(&mut plan.details, node);

    if let Some(Value::Array(plans)) = node.get("Plans") {
        for (i, child) in plans.iter().enumerate() {
            let child_id = format!("{id}.{i}");
            let mut child_plan = parse_pg_node(child, &child_id);
            if let (Some(parent_total), Some(child_total)) =
                (plan.cost.actual_total_ms, child_plan.cost.actual_total_ms)
            {
                let self_ms = (parent_total - child_total).max(0.0);
                plan.cost.self_ms = Some(self_ms);
                child_plan.cost.self_ms = child_plan.cost.self_ms.or(Some(child_total));
            }
            plan.children.push(child_plan);
        }
    }

    flag_warnings(&mut plan);
    plan
}

pub fn parse_mysql(root_json: &Value) -> Result<PlanNode, String> {
    let query_block = root_json
        .get("query_block")
        .ok_or_else(|| "MySQL EXPLAIN output missing query_block".to_string())?;
    Ok(parse_mysql_block(query_block, "m"))
}

fn parse_mysql_block(node: &Value, id: &str) -> PlanNode {
    if let Some(table) = node.get("table") {
        return parse_mysql_table(table, id);
    }

    let nested_key = ["nested_loop", "ordering_operation", "grouping_operation"]
        .iter()
        .find(|k| node.get(**k).is_some());

    let node_type = if let Some(key) = nested_key {
        match *key {
            "nested_loop" => "Nested Loop",
            "ordering_operation" => "Ordering",
            "grouping_operation" => "Grouping",
            _ => "Query Block",
        }
    } else {
        "Query Block"
    };

    let mut plan = PlanNode::new(id.to_string(), node_type.to_string(), node_type.to_string());

    plan.cost.total = node
        .get("cost_info")
        .and_then(|c| c.get("query_cost"))
        .and_then(string_or_number);
    plan.rows.estimated = node.get("rows_produced_per_join").and_then(Value::as_f64);

    copy_simple_fields(&mut plan.details, node);

    if let Some(Value::Array(arr)) = node.get(nested_key.unwrap_or(&"")) {
        for (i, child) in arr.iter().enumerate() {
            let child_id = format!("{id}.{i}");
            plan.children.push(parse_mysql_block(child, &child_id));
        }
    } else if let Some(inner) = node
        .get("ordering_operation")
        .or_else(|| node.get("grouping_operation"))
    {
        plan.children
            .push(parse_mysql_block(inner, &format!("{id}.0")));
    }

    flag_warnings(&mut plan);
    plan
}

fn parse_mysql_table(table: &Value, id: &str) -> PlanNode {
    let access_type = table
        .get("access_type")
        .and_then(Value::as_str)
        .unwrap_or("table");
    let table_name = table
        .get("table_name")
        .and_then(Value::as_str)
        .unwrap_or("?");
    let node_type = match access_type {
        "ALL" => "Full Table Scan".to_string(),
        "index" => "Full Index Scan".to_string(),
        "range" => "Range Scan".to_string(),
        "ref" => "Ref Scan".to_string(),
        "const" | "eq_ref" => "Const Scan".to_string(),
        other => format!("{} Scan", other),
    };
    let label = format!("{node_type} on {table_name}");
    let mut plan = PlanNode::new(id.to_string(), node_type, label);

    plan.cost.total = table
        .get("cost_info")
        .and_then(|c| c.get("read_cost"))
        .and_then(string_or_number);
    plan.rows.estimated = table.get("rows_examined_per_scan").and_then(Value::as_f64);

    copy_simple_fields(&mut plan.details, table);
    flag_warnings(&mut plan);
    plan
}

pub fn parse_clickhouse(root_json: &Value) -> Result<PlanNode, String> {
    let root_plan = match root_json {
        Value::Array(arr) => arr
            .first()
            .and_then(|v| v.get("Plan"))
            .or_else(|| arr.first())
            .ok_or_else(|| "ClickHouse EXPLAIN empty".to_string())?,
        Value::Object(obj) => obj.get("Plan").unwrap_or(root_json),
        _ => return Err("Unexpected ClickHouse EXPLAIN shape".to_string()),
    };
    Ok(parse_ch_node(root_plan, "c"))
}

fn parse_ch_node(node: &Value, id: &str) -> PlanNode {
    let node_type = node
        .get("Node Type")
        .and_then(Value::as_str)
        .unwrap_or("Unknown")
        .to_string();
    let description = node.get("Description").and_then(Value::as_str);
    let label = match description {
        Some(d) if !d.is_empty() => format!("{node_type} — {d}"),
        _ => node_type.clone(),
    };
    let mut plan = PlanNode::new(id.to_string(), node_type, label);
    copy_simple_fields(&mut plan.details, node);

    if let Some(Value::Array(plans)) = node.get("Plans") {
        for (i, child) in plans.iter().enumerate() {
            plan.children
                .push(parse_ch_node(child, &format!("{id}.{i}")));
        }
    }
    flag_warnings(&mut plan);
    plan
}

pub fn parse_duckdb(root_json: &Value) -> Result<PlanNode, String> {
    let root = match root_json {
        Value::Array(arr) => arr
            .first()
            .ok_or_else(|| "DuckDB EXPLAIN empty".to_string())?,
        other => other,
    };
    Ok(parse_duck_node(root, "d"))
}

fn parse_duck_node(node: &Value, id: &str) -> PlanNode {
    let node_type = node
        .get("name")
        .and_then(Value::as_str)
        .or_else(|| node.get("operator_type").and_then(Value::as_str))
        .unwrap_or("Unknown")
        .to_string();

    let extra = node
        .get("extra_info")
        .and_then(Value::as_str)
        .map(|s| s.split('\n').next().unwrap_or(s).to_string())
        .filter(|s| !s.is_empty());
    let label = match extra {
        Some(e) => format!("{node_type} — {e}"),
        None => node_type.clone(),
    };

    let mut plan = PlanNode::new(id.to_string(), node_type, label);

    let cardinality = node
        .get("operator_cardinality")
        .or_else(|| node.get("cardinality"))
        .and_then(Value::as_f64);
    plan.rows.estimated = cardinality;

    if let Some(timing) = node.get("operator_timing").and_then(Value::as_f64) {
        plan.timing.actual_total_ms = Some(timing * 1000.0);
        plan.cost.actual_total_ms = Some(timing * 1000.0);
        plan.cost.self_ms = Some(timing * 1000.0);
    }

    copy_simple_fields(&mut plan.details, node);

    if let Some(Value::Array(children)) = node.get("children") {
        for (i, child) in children.iter().enumerate() {
            let mut child_plan = parse_duck_node(child, &format!("{id}.{i}"));
            if let (Some(parent_total), Some(child_total)) =
                (plan.cost.actual_total_ms, child_plan.cost.actual_total_ms)
            {
                let self_ms = (parent_total - child_total).max(0.0);
                plan.cost.self_ms = Some(self_ms);
                child_plan.cost.self_ms = child_plan.cost.self_ms.or(Some(child_total));
            }
            plan.children.push(child_plan);
        }
    }

    flag_warnings(&mut plan);
    plan
}

fn copy_simple_fields(target: &mut Vec<(String, String)>, node: &Value) {
    if let Value::Object(map) = node {
        for (k, v) in map {
            if matches!(
                k.as_str(),
                "Plans" | "Plan" | "children" | "nested_loop" | "query_block"
            ) {
                continue;
            }
            let s = match v {
                Value::String(s) => s.clone(),
                Value::Null => continue,
                Value::Number(n) => n.to_string(),
                Value::Bool(b) => b.to_string(),
                Value::Array(_) | Value::Object(_) => {
                    if let Ok(pretty) = serde_json::to_string(v) {
                        if pretty.len() <= 120 {
                            pretty
                        } else {
                            continue;
                        }
                    } else {
                        continue;
                    }
                }
            };
            target.push((k.clone(), s));
        }
    }
}

fn build_label(
    node_type: &str,
    relation: Option<&str>,
    index: Option<&str>,
    alias: Option<&str>,
) -> String {
    let target = relation.or(index);
    match (target, alias) {
        (Some(t), Some(a)) if a != t => format!("{node_type} on {t} ({a})"),
        (Some(t), _) => format!("{node_type} on {t}"),
        _ => node_type.to_string(),
    }
}

fn string_or_number(v: &Value) -> Option<f64> {
    match v {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.parse::<f64>().ok(),
        _ => None,
    }
}

fn flag_warnings(plan: &mut PlanNode) {
    if plan.node_type.eq_ignore_ascii_case("Seq Scan") {
        plan.warnings.push("Sequential scan".to_string());
    }
    if plan.node_type == "Full Table Scan" {
        plan.warnings.push("Full table scan".to_string());
    }
    if let (Some(est), Some(actual)) = (plan.rows.estimated, plan.rows.actual) {
        if actual > 0.0 && est > 0.0 {
            let ratio = (actual / est).max(est / actual);
            if ratio > 10.0 {
                plan.warnings
                    .push(format!("Row estimate off by {:.0}×", ratio));
            }
        }
    }
    if plan
        .details
        .iter()
        .any(|(k, v)| k == "Sort Method" && v.contains("disk"))
    {
        plan.warnings.push("Disk sort".to_string());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_minimal_postgres_plan() {
        let input = serde_json::json!([
            {
                "Plan": {
                    "Node Type": "Seq Scan",
                    "Relation Name": "users",
                    "Alias": "u",
                    "Startup Cost": 0.0,
                    "Total Cost": 431.0,
                    "Plan Rows": 10000,
                    "Actual Rows": 10000,
                    "Actual Total Time": 1.2,
                    "Actual Loops": 1,
                }
            }
        ]);
        let plan = parse_postgres(&input).unwrap();
        assert_eq!(plan.node_type, "Seq Scan");
        assert_eq!(plan.label, "Seq Scan on users (u)");
        assert_eq!(plan.cost.total, Some(431.0));
        assert_eq!(plan.cost.actual_total_ms, Some(1.2));
        assert!(plan.warnings.iter().any(|w| w.contains("Sequential")));
    }

    #[test]
    fn parses_postgres_join_tree() {
        let input = serde_json::json!([
            {
                "Plan": {
                    "Node Type": "Hash Join",
                    "Startup Cost": 10.0,
                    "Total Cost": 100.0,
                    "Actual Total Time": 5.0,
                    "Actual Loops": 1,
                    "Plans": [
                        { "Node Type": "Seq Scan", "Relation Name": "a", "Actual Total Time": 2.0, "Actual Loops": 1 },
                        { "Node Type": "Seq Scan", "Relation Name": "b", "Actual Total Time": 1.0, "Actual Loops": 1 }
                    ]
                }
            }
        ]);
        let plan = parse_postgres(&input).unwrap();
        assert_eq!(plan.node_type, "Hash Join");
        assert_eq!(plan.children.len(), 2);
        assert_eq!(plan.children[0].node_type, "Seq Scan");
        assert!(plan.cost.self_ms.is_some());
    }

    #[test]
    fn flags_row_estimate_mismatch() {
        let input = serde_json::json!([
            {
                "Plan": {
                    "Node Type": "Index Scan",
                    "Plan Rows": 10,
                    "Actual Rows": 500,
                }
            }
        ]);
        let plan = parse_postgres(&input).unwrap();
        assert!(plan
            .warnings
            .iter()
            .any(|w| w.starts_with("Row estimate off")));
    }

    #[test]
    fn parses_mysql_simple_table() {
        let input = serde_json::json!({
            "query_block": {
                "select_id": 1,
                "cost_info": { "query_cost": "10.50" },
                "table": {
                    "table_name": "users",
                    "access_type": "ALL",
                    "rows_examined_per_scan": 1000,
                    "cost_info": { "read_cost": "5.25" }
                }
            }
        });
        let plan = parse_mysql(&input).unwrap();
        assert_eq!(plan.node_type, "Full Table Scan");
        assert!(plan.label.contains("users"));
        assert!(plan.warnings.iter().any(|w| w.contains("Full table")));
    }

    #[test]
    fn parses_mysql_nested_loop() {
        let input = serde_json::json!({
            "query_block": {
                "select_id": 1,
                "nested_loop": [
                    { "table": { "table_name": "a", "access_type": "ALL", "rows_examined_per_scan": 100 } },
                    { "table": { "table_name": "b", "access_type": "ref", "rows_examined_per_scan": 1 } }
                ]
            }
        });
        let plan = parse_mysql(&input).unwrap();
        assert_eq!(plan.node_type, "Nested Loop");
        assert_eq!(plan.children.len(), 2);
    }

    #[test]
    fn parses_clickhouse_tree() {
        let input = serde_json::json!([
            {
                "Plan": {
                    "Node Type": "Expression",
                    "Description": "(Projection)",
                    "Plans": [
                        { "Node Type": "ReadFromMergeTree", "Description": "events" }
                    ]
                }
            }
        ]);
        let plan = parse_clickhouse(&input).unwrap();
        assert_eq!(plan.node_type, "Expression");
        assert_eq!(plan.children.len(), 1);
        assert_eq!(plan.children[0].node_type, "ReadFromMergeTree");
    }

    #[test]
    fn parses_duckdb_tree() {
        let input = serde_json::json!({
            "name": "HASH_JOIN",
            "operator_cardinality": 1000,
            "operator_timing": 0.005,
            "children": [
                { "name": "SEQ_SCAN", "extra_info": "a", "operator_cardinality": 500 },
                { "name": "SEQ_SCAN", "extra_info": "b", "operator_cardinality": 100 }
            ]
        });
        let plan = parse_duckdb(&input).unwrap();
        assert_eq!(plan.node_type, "HASH_JOIN");
        assert_eq!(plan.children.len(), 2);
        assert_eq!(plan.cost.actual_total_ms, Some(5.0));
    }

    #[test]
    fn postgres_plan_rejects_unknown_shape() {
        let input = serde_json::json!("not a plan");
        assert!(parse_postgres(&input).is_err());
    }
}
