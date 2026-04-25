use app_lib::db::explain::parser::{parse_mysql, parse_postgres};
use codspeed_criterion_compat::{black_box, criterion_group, criterion_main, Criterion};
use serde_json::{json, Value};

fn postgres_small_plan() -> Value {
    json!([{
        "Plan": {
            "Node Type": "Hash Join",
            "Startup Cost": 1.23,
            "Total Cost": 45.67,
            "Plan Rows": 100.0,
            "Actual Rows": 98.0,
            "Actual Total Time": 2.4,
            "Actual Startup Time": 0.1,
            "Actual Loops": 1.0,
            "Hash Cond": "(o.customer_id = c.id)",
            "Plans": [
                {
                    "Node Type": "Seq Scan",
                    "Relation Name": "orders",
                    "Alias": "o",
                    "Startup Cost": 0.0,
                    "Total Cost": 12.5,
                    "Plan Rows": 200.0,
                    "Actual Rows": 195.0,
                    "Actual Total Time": 0.8,
                    "Actual Loops": 1.0
                },
                {
                    "Node Type": "Hash",
                    "Startup Cost": 5.0,
                    "Total Cost": 5.0,
                    "Plans": [
                        {
                            "Node Type": "Index Scan",
                            "Relation Name": "customers",
                            "Index Name": "customers_pkey",
                            "Alias": "c",
                            "Startup Cost": 0.1,
                            "Total Cost": 4.9,
                            "Plan Rows": 50.0,
                            "Actual Rows": 48.0,
                            "Actual Total Time": 0.5,
                            "Actual Loops": 1.0
                        }
                    ]
                }
            ]
        }
    }])
}

fn postgres_deep_plan() -> Value {
    fn nest(depth: usize) -> Value {
        if depth == 0 {
            return json!({
                "Node Type": "Seq Scan",
                "Relation Name": format!("tbl_{depth}"),
                "Startup Cost": 0.0,
                "Total Cost": 10.0,
                "Plan Rows": 1000.0,
                "Actual Rows": 950.0,
                "Actual Total Time": 1.2,
                "Actual Loops": 1.0,
                "Shared Hit Blocks": 12,
                "Shared Read Blocks": 4
            });
        }
        json!({
            "Node Type": "Nested Loop",
            "Startup Cost": 0.5 * depth as f64,
            "Total Cost": 100.0 * depth as f64,
            "Plan Rows": 500.0,
            "Actual Rows": 480.0,
            "Actual Total Time": 3.0 * depth as f64,
            "Actual Startup Time": 0.2,
            "Actual Loops": 1.0,
            "Plans": [nest(depth - 1), nest(depth - 1)]
        })
    }
    json!([{ "Plan": nest(8) }])
}

fn mysql_plan() -> Value {
    json!({
        "query_block": {
            "select_id": 1,
            "cost_info": { "query_cost": "123.45" },
            "ordering_operation": {
                "using_filesort": true,
                "nested_loop": [
                    {
                        "table": {
                            "table_name": "customers",
                            "access_type": "ref",
                            "rows_examined_per_scan": 1000,
                            "rows_produced_per_join": 950,
                            "filtered": "95.00",
                            "cost_info": {
                                "read_cost": "10.0",
                                "eval_cost": "95.0",
                                "prefix_cost": "105.0"
                            }
                        }
                    },
                    {
                        "table": {
                            "table_name": "orders",
                            "access_type": "eq_ref",
                            "rows_examined_per_scan": 1,
                            "rows_produced_per_join": 900,
                            "filtered": "100.00",
                            "cost_info": {
                                "read_cost": "100.0",
                                "eval_cost": "90.0",
                                "prefix_cost": "295.0"
                            }
                        }
                    }
                ]
            }
        }
    })
}

fn bench_parse(c: &mut Criterion) {
    let pg_small = postgres_small_plan();
    let pg_deep = postgres_deep_plan();
    let my = mysql_plan();

    c.bench_function("parse_postgres_small", |b| {
        b.iter(|| parse_postgres(black_box(&pg_small)).unwrap());
    });

    c.bench_function("parse_postgres_deep", |b| {
        b.iter(|| parse_postgres(black_box(&pg_deep)).unwrap());
    });

    c.bench_function("parse_mysql", |b| {
        b.iter(|| parse_mysql(black_box(&my)).unwrap());
    });
}

criterion_group!(benches, bench_parse);
criterion_main!(benches);
