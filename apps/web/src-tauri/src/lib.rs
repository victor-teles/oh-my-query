mod commands;
mod config;
mod db;
mod persistence;

use db::pool::ConnectionPoolManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .manage(ConnectionPoolManager::new())
        .invoke_handler(tauri::generate_handler![
            commands::test_connection,
            commands::connect_to_database,
            commands::disconnect_from_database,
            commands::get_server_version,
            commands::execute_query,
            commands::list_connection_databases,
            commands::get_schema,
            commands::format_sql,
            config::get_config,
            config::save_config,
            persistence::get_tabs,
            persistence::save_tabs,
            persistence::append_history,
            persistence::get_history,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
