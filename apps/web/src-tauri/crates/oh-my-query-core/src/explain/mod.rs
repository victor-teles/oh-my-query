pub mod parser;

use serde::{Deserialize, Serialize};

pub use parser::PlanNode;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplainParams {
    pub connection_id: String,
    pub sql: String,
    #[serde(default)]
    pub analyze: bool,
    pub schema: Option<String>,
    pub source_dialect: Option<String>,
    pub query_id: Option<String>,
    pub timeout_secs: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplainResult {
    pub engine: &'static str,
    pub root: PlanNode,
    pub raw: String,
    pub analyze_ran: bool,
    pub supports_analyze: bool,
    pub execution_time_ms: u64,
}
