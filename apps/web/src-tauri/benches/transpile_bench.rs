use app_lib::db::transpile::{format_sql, transpile_sql};
use codspeed_criterion_compat::{black_box, criterion_group, criterion_main, Criterion};
use polyglot_sql::DialectType;

const SIMPLE_MYSQL: &str = r#"select IFNULL(avatar_url, name) FROM "users""#;

const COMPLEX_MYSQL: &str = r#"
WITH recent_orders AS (
    SELECT customer_id, order_id, total, created_at
    FROM orders
    WHERE created_at > NOW() - INTERVAL 30 DAY
)
SELECT
    c.id,
    c.name,
    IFNULL(SUM(o.total), 0) AS lifetime_value,
    ROW_NUMBER() OVER (PARTITION BY c.region ORDER BY SUM(o.total) DESC) AS region_rank,
    GROUP_CONCAT(DISTINCT o.order_id ORDER BY o.created_at DESC SEPARATOR ',') AS recent_ids
FROM customers c
LEFT JOIN recent_orders o ON o.customer_id = c.id
WHERE c.active = 1 AND c.region IN ('us-east', 'us-west', 'eu-west')
GROUP BY c.id, c.name, c.region
HAVING lifetime_value > 1000
ORDER BY region_rank
LIMIT 100
"#;

const MULTI_STATEMENT_PG: &str =
    "select id, name from users where active = true; select count(*) from orders; select now()";

fn bench_transpile(c: &mut Criterion) {
    c.bench_function("transpile_mysql_to_postgres_simple", |b| {
        b.iter(|| {
            transpile_sql(black_box(SIMPLE_MYSQL), "mysql", DialectType::PostgreSQL).unwrap()
        });
    });

    c.bench_function("transpile_mysql_to_postgres_complex", |b| {
        b.iter(|| {
            transpile_sql(black_box(COMPLEX_MYSQL), "mysql", DialectType::PostgreSQL).unwrap()
        });
    });

    c.bench_function("transpile_same_dialect_passthrough", |b| {
        b.iter(|| {
            transpile_sql(black_box("SELECT 1"), "postgresql", DialectType::PostgreSQL).unwrap()
        });
    });
}

fn bench_format(c: &mut Criterion) {
    c.bench_function("format_postgres_multi_statement", |b| {
        b.iter(|| format_sql(black_box(MULTI_STATEMENT_PG), "postgresql").unwrap());
    });
}

criterion_group!(benches, bench_transpile, bench_format);
criterion_main!(benches);
