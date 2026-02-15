mod commands;
mod db;

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
            commands::execute_query,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
