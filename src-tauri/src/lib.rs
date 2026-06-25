//! Todaymarks backend — a small native macOS calendar for Apple Calendar events
//! plus quick local events.

pub mod commands;
pub mod debug;
pub mod models;
pub mod providers;
pub mod state;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default().plugin(tauri_plugin_opener::init());

    // Desktop-only auto-update support.
    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init());
    }

    builder
        .setup(|app| {
            let state = AppState::new()?;
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::save_settings,
            commands::set_calendar_color,
            commands::apple_authorization_status,
            commands::request_apple_access,
            commands::open_calendar_privacy_settings,
            commands::list_calendars,
            commands::list_events,
            commands::create_apple_event,
            commands::update_apple_event,
            commands::save_event,
            commands::delete_event,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Todaymarks");
}
