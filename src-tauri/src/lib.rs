//! Todaymarks backend — a small native macOS calendar for Apple Calendar events
//! plus quick local events.

pub mod commands;
pub mod debug;
pub mod feed;
pub mod ics;
pub mod models;
pub mod providers;
pub mod state;

use state::AppState;
use tauri::Manager;

#[cfg(desktop)]
fn show_main(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default().plugin(tauri_plugin_opener::init());

    // Desktop-only: auto-update, notifications, autostart, tray.
    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init())
            .plugin(tauri_plugin_notification::init())
            .plugin(tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                None,
            ));
    }

    builder
        .setup(|app| {
            let state = AppState::new()?;
            app.manage(state);

            #[cfg(desktop)]
            build_tray(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // Hide to the menu bar instead of quitting, so notifications keep
            // working — unless the user turned that off.
            #[cfg(desktop)]
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let keep_running = window.state::<AppState>().get_settings().menu_bar_mode;
                if keep_running {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::save_settings,
            commands::set_calendar_color,
            commands::set_launch_at_login,
            commands::publish_ics_feed,
            commands::delete_ics_feed,
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

#[cfg(desktop)]
fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

    let open_i = MenuItem::with_id(app, "open", "Open Todaymarks", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit Todaymarks", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open_i, &quit_i])?;

    let mut tray = TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}
