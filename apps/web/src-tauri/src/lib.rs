mod commands;
mod config;
mod db;
mod persistence;

use db::pool::ConnectionPoolManager;
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .manage(ConnectionPoolManager::new())
        .setup(|app| {
            let app_submenu = SubmenuBuilder::new(app, "oh-my-query")
                .about(None)
                .separator()
                .item(
                    &MenuItemBuilder::with_id("settings", "Settings...")
                        .accelerator("CmdOrCtrl+,")
                        .build(app)?,
                )
                .separator()
                .services()
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;

            let edit_submenu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let view_submenu = SubmenuBuilder::new(app, "View")
                .item(&PredefinedMenuItem::fullscreen(app, None)?)
                .build()?;

            let window_submenu = SubmenuBuilder::new(app, "Window")
                .minimize()
                .item(&PredefinedMenuItem::maximize(app, None)?)
                .close_window()
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_submenu)
                .item(&edit_submenu)
                .item(&view_submenu)
                .item(&window_submenu)
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(move |app_handle, event| {
                if event.id().0.as_str() == "settings" {
                    let _ = app_handle.emit("menu-navigate", "/settings");
                }
            });

            Ok(())
        })
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
