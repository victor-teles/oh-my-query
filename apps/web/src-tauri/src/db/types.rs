use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaInfo {
    pub schemas: Vec<SchemaItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaItem {
    pub name: String,
    pub tables: Vec<TableItem>,
    pub views: Vec<ViewItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TableItem {
    pub name: String,
    pub columns: Vec<ColumnDetail>,
    pub indexes: Vec<IndexItem>,
    pub foreign_keys: Vec<ForeignKeyItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewItem {
    pub name: String,
    pub columns: Vec<ColumnDetail>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnDetail {
    pub name: String,
    pub data_type: String,
    pub is_nullable: bool,
    pub is_primary_key: bool,
    pub default_value: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexItem {
    pub name: String,
    pub columns: Vec<String>,
    pub is_unique: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ForeignKeyItem {
    pub name: String,
    pub columns: Vec<String>,
    pub referenced_table: String,
    pub referenced_columns: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionParams {
    #[serde(rename = "type")]
    pub db_type: String,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TestConnectionResult {
    pub success: bool,
    pub message: String,
    pub latency_ms: u64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryParams {
    pub connection_id: String,
    pub sql: String,
    pub max_rows: Option<u64>,
    pub timeout_secs: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnInfo {
    pub name: String,
    pub type_name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryResult {
    pub columns: Vec<ColumnInfo>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub row_count: u64,
    pub execution_time_ms: u64,
    pub is_truncated: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "resultType")]
pub enum ExecuteResult {
    #[serde(rename = "tabular", rename_all = "camelCase")]
    Tabular {
        columns: Vec<ColumnInfo>,
        rows: Vec<Vec<serde_json::Value>>,
        row_count: u64,
        execution_time_ms: u64,
        is_truncated: bool,
    },
    #[serde(rename = "documents", rename_all = "camelCase")]
    Documents {
        documents: Vec<serde_json::Value>,
        count: u64,
        execution_time_ms: u64,
        is_truncated: bool,
    },
}

impl From<QueryResult> for ExecuteResult {
    fn from(r: QueryResult) -> Self {
        ExecuteResult::Tabular {
            columns: r.columns,
            rows: r.rows,
            row_count: r.row_count,
            execution_time_ms: r.execution_time_ms,
            is_truncated: r.is_truncated,
        }
    }
}

