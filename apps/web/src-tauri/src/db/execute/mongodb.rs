use crate::db::error::DbError;
use crate::db::types::{ColumnInfo, ExecuteResult};

struct MongoCommand {
    collection: String,
    operation: String,
    args: Vec<String>,
}

fn parse_mongo_command(input: &str) -> Result<MongoCommand, DbError> {
    let input = input.trim();
    let input = input.strip_prefix("db.").ok_or_else(|| DbError {
        code: "PARSE_ERROR".to_string(),
        message: "MongoDB command must start with 'db.'".to_string(),
    })?;

    let dot_pos = input.find('.').ok_or_else(|| DbError {
        code: "PARSE_ERROR".to_string(),
        message: "Expected format: db.collection.operation(...)".to_string(),
    })?;

    let collection = input[..dot_pos].to_string();
    let rest = &input[dot_pos + 1..];

    let paren_pos = rest.find('(').ok_or_else(|| DbError {
        code: "PARSE_ERROR".to_string(),
        message: "Expected format: db.collection.operation(...)".to_string(),
    })?;

    let operation = rest[..paren_pos].to_string();

    let args_str = rest[paren_pos + 1..]
        .strip_suffix(')')
        .ok_or_else(|| DbError {
            code: "PARSE_ERROR".to_string(),
            message: "Missing closing parenthesis".to_string(),
        })?
        .trim();

    let args = if args_str.is_empty() {
        vec![]
    } else {
        split_json_args(args_str)
    };

    Ok(MongoCommand {
        collection,
        operation,
        args,
    })
}

fn split_json_args(input: &str) -> Vec<String> {
    let mut args = Vec::new();
    let mut depth = 0;
    let mut start = 0;

    for (i, ch) in input.char_indices() {
        match ch {
            '{' | '[' => depth += 1,
            '}' | ']' => depth -= 1,
            ',' if depth == 0 => {
                let arg = input[start..i].trim().to_string();
                if !arg.is_empty() {
                    args.push(arg);
                }
                start = i + 1;
            }
            _ => {}
        }
    }

    let last = input[start..].trim().to_string();
    if !last.is_empty() {
        args.push(last);
    }

    args
}

fn parse_bson_doc(json_str: &str) -> Result<mongodb::bson::Document, DbError> {
    let value: serde_json::Value = serde_json::from_str(json_str).map_err(|e| DbError {
        code: "PARSE_ERROR".to_string(),
        message: format!("Invalid JSON: {e}"),
    })?;
    let bson = mongodb::bson::to_bson(&value).map_err(|e| DbError {
        code: "PARSE_ERROR".to_string(),
        message: format!("Cannot convert to BSON: {e}"),
    })?;
    match bson {
        mongodb::bson::Bson::Document(doc) => Ok(doc),
        _ => Err(DbError {
            code: "PARSE_ERROR".to_string(),
            message: "Expected a JSON object".to_string(),
        }),
    }
}

fn bson_doc_to_json(doc: &mongodb::bson::Document) -> serde_json::Value {
    let bson = mongodb::bson::Bson::Document(doc.clone());
    bson.clone().into_relaxed_extjson()
}

pub async fn execute_mongodb(
    client: &mongodb::Client,
    command: &str,
    max_rows: usize,
) -> Result<ExecuteResult, DbError> {
    let cmd = parse_mongo_command(command)?;
    let db = client.default_database().ok_or_else(|| DbError {
        code: "NO_DATABASE".to_string(),
        message: "No default database selected. Specify a database in the connection.".to_string(),
    })?;
    let coll = db.collection::<mongodb::bson::Document>(&cmd.collection);

    match cmd.operation.as_str() {
        "find" => {
            let filter = if cmd.args.is_empty() {
                mongodb::bson::doc! {}
            } else {
                parse_bson_doc(&cmd.args[0])?
            };

            let mut cursor = coll
                .find(filter)
                .limit(max_rows as i64)
                .await
                .map_err(DbError::from)?;

            let mut documents = Vec::new();
            let mut is_truncated = false;

            while cursor.advance().await.map_err(DbError::from)? {
                if documents.len() >= max_rows {
                    is_truncated = true;
                    break;
                }
                let doc = cursor.deserialize_current().map_err(DbError::from)?;
                documents.push(bson_doc_to_json(&doc));
            }

            let count = documents.len() as u64;
            Ok(ExecuteResult::Documents {
                documents,
                count,
                execution_time_ms: 0,
                is_truncated,
            })
        }
        "findOne" => {
            let filter = if cmd.args.is_empty() {
                mongodb::bson::doc! {}
            } else {
                parse_bson_doc(&cmd.args[0])?
            };

            let doc = coll.find_one(filter).await.map_err(DbError::from)?;
            let documents = match doc {
                Some(d) => vec![bson_doc_to_json(&d)],
                None => vec![],
            };
            let count = documents.len() as u64;

            Ok(ExecuteResult::Documents {
                documents,
                count,
                execution_time_ms: 0,
                is_truncated: false,
            })
        }
        "insertOne" => {
            let doc = parse_bson_doc(cmd.args.first().ok_or_else(|| DbError {
                code: "PARSE_ERROR".to_string(),
                message: "insertOne requires a document argument".to_string(),
            })?)?;

            let result = coll.insert_one(doc).await.map_err(DbError::from)?;
            let id_str = format!("{}", result.inserted_id);

            Ok(ExecuteResult::Tabular {
                columns: vec![ColumnInfo {
                    name: "insertedId".to_string(),
                    type_name: "ObjectId".to_string(),
                }],
                rows: vec![vec![serde_json::Value::String(id_str)]],
                row_count: 1,
                execution_time_ms: 0,
                is_truncated: false,
            })
        }
        "updateOne" => {
            if cmd.args.len() < 2 {
                return Err(DbError {
                    code: "PARSE_ERROR".to_string(),
                    message: "updateOne requires filter and update arguments".to_string(),
                });
            }
            let filter = parse_bson_doc(&cmd.args[0])?;
            let update = parse_bson_doc(&cmd.args[1])?;

            let result = coll
                .update_one(filter, update)
                .await
                .map_err(DbError::from)?;

            Ok(ExecuteResult::Tabular {
                columns: vec![
                    ColumnInfo {
                        name: "matchedCount".to_string(),
                        type_name: "INT".to_string(),
                    },
                    ColumnInfo {
                        name: "modifiedCount".to_string(),
                        type_name: "INT".to_string(),
                    },
                ],
                rows: vec![vec![
                    serde_json::Value::Number(result.matched_count.into()),
                    serde_json::Value::Number(result.modified_count.into()),
                ]],
                row_count: 1,
                execution_time_ms: 0,
                is_truncated: false,
            })
        }
        "deleteOne" => {
            let filter = if cmd.args.is_empty() {
                mongodb::bson::doc! {}
            } else {
                parse_bson_doc(&cmd.args[0])?
            };

            let result = coll.delete_one(filter).await.map_err(DbError::from)?;

            Ok(ExecuteResult::Tabular {
                columns: vec![ColumnInfo {
                    name: "deletedCount".to_string(),
                    type_name: "INT".to_string(),
                }],
                rows: vec![vec![serde_json::Value::Number(
                    result.deleted_count.into(),
                )]],
                row_count: 1,
                execution_time_ms: 0,
                is_truncated: false,
            })
        }
        "countDocuments" => {
            let filter = if cmd.args.is_empty() {
                mongodb::bson::doc! {}
            } else {
                parse_bson_doc(&cmd.args[0])?
            };

            let count = coll
                .count_documents(filter)
                .await
                .map_err(DbError::from)?;

            Ok(ExecuteResult::Tabular {
                columns: vec![ColumnInfo {
                    name: "count".to_string(),
                    type_name: "INT".to_string(),
                }],
                rows: vec![vec![serde_json::Value::Number(count.into())]],
                row_count: 1,
                execution_time_ms: 0,
                is_truncated: false,
            })
        }
        "aggregate" => {
            let pipeline_str = cmd.args.first().ok_or_else(|| DbError {
                code: "PARSE_ERROR".to_string(),
                message: "aggregate requires a pipeline argument".to_string(),
            })?;

            let pipeline_value: serde_json::Value =
                serde_json::from_str(pipeline_str).map_err(|e| DbError {
                    code: "PARSE_ERROR".to_string(),
                    message: format!("Invalid JSON pipeline: {e}"),
                })?;

            let pipeline_bson =
                mongodb::bson::to_bson(&pipeline_value).map_err(|e| DbError {
                    code: "PARSE_ERROR".to_string(),
                    message: format!("Cannot convert pipeline to BSON: {e}"),
                })?;

            let pipeline = match pipeline_bson {
                mongodb::bson::Bson::Array(arr) => {
                    let mut docs = Vec::new();
                    for item in arr {
                        match item {
                            mongodb::bson::Bson::Document(doc) => docs.push(doc),
                            _ => {
                                return Err(DbError {
                                    code: "PARSE_ERROR".to_string(),
                                    message: "Pipeline stages must be objects".to_string(),
                                })
                            }
                        }
                    }
                    docs
                }
                _ => {
                    return Err(DbError {
                        code: "PARSE_ERROR".to_string(),
                        message: "Pipeline must be an array".to_string(),
                    })
                }
            };

            let mut cursor = coll.aggregate(pipeline).await.map_err(DbError::from)?;
            let mut documents = Vec::new();
            let mut is_truncated = false;

            while cursor.advance().await.map_err(DbError::from)? {
                if documents.len() >= max_rows {
                    is_truncated = true;
                    break;
                }
                let doc = cursor.deserialize_current().map_err(DbError::from)?;
                documents.push(bson_doc_to_json(&doc));
            }

            let count = documents.len() as u64;
            Ok(ExecuteResult::Documents {
                documents,
                count,
                execution_time_ms: 0,
                is_truncated,
            })
        }
        other => Err(DbError {
            code: "UNSUPPORTED_OPERATION".to_string(),
            message: format!(
                "Unsupported MongoDB operation: {other}. Supported: find, findOne, insertOne, updateOne, deleteOne, countDocuments, aggregate"
            ),
        }),
    }
}
