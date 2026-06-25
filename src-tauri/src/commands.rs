//! Tauri commands — the bridge the React frontend calls via `invoke`.

use crate::models::{CalendarEvent, CalendarInfo, EventInput, EventSource};
use crate::providers::{apple, local};
use crate::state::{AppState, Settings};
use tauri::State;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Settings {
    state.get_settings()
}

#[tauri::command]
pub fn save_settings(state: State<'_, AppState>, settings: Settings) -> Result<Settings, String> {
    state.save_settings(settings).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_calendar_color(
    state: State<'_, AppState>,
    calendar_id: String,
    color: Option<String>,
) -> Result<Settings, String> {
    let mut s = state.get_settings();
    match color {
        Some(c) => {
            s.calendar_colors.insert(calendar_id, c);
        }
        None => {
            s.calendar_colors.remove(&calendar_id);
        }
    }
    state.save_settings(s).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Apple Calendar permission
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn apple_authorization_status() -> Result<String, String> {
    tokio::task::spawn_blocking(apple::authorization_status)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn request_apple_access() -> Result<bool, String> {
    tokio::task::spawn_blocking(apple::request_access)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn open_calendar_privacy_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars")
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Calendars + events
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn list_calendars(state: State<'_, AppState>) -> Result<Vec<CalendarInfo>, String> {
    let settings = state.get_settings();

    let mut out: Vec<CalendarInfo> = Vec::new();

    // Apple calendars (off-thread; EventKit is blocking).
    let apple_cals = tokio::task::spawn_blocking(apple::list_calendars)
        .await
        .map_err(|e| e.to_string())?
        .unwrap_or_default();
    for (id, name, color, editable) in apple_cals {
        let color = settings.color_for(&Some(id.clone()), &color);
        out.push(CalendarInfo {
            id,
            name,
            color,
            source: EventSource::Apple,
            editable,
        });
    }

    // Local calendar.
    let (id, name, color) = local::local_calendar();
    let color = settings.color_for(&Some(id.clone()), &color);
    out.push(CalendarInfo {
        id,
        name,
        color,
        source: EventSource::Local,
        editable: true,
    });

    Ok(out)
}

#[tauri::command]
pub async fn list_events(
    state: State<'_, AppState>,
    start: i64,
    end: i64,
) -> Result<Vec<CalendarEvent>, String> {
    let settings = state.get_settings();
    let db_path = state.db_path.clone();

    let mut events: Vec<CalendarEvent> = Vec::new();

    // Apple (EventKit) and local (SQLite) run concurrently.
    let apple_fut = tokio::task::spawn_blocking(move || apple::list_events(start, end));
    let db = db_path.clone();
    let local_fut = tokio::task::spawn_blocking(move || local::list_events(&db, start, end));

    let (apple_res, local_res) = tokio::join!(apple_fut, local_fut);

    if let Ok(Ok(mut apple_events)) = apple_res {
        events.append(&mut apple_events);
    }
    if let Ok(Ok(mut local_events)) = local_res {
        events.append(&mut local_events);
    }

    // Hide calendars the user toggled off.
    if !settings.hidden_calendar_ids.is_empty() {
        events.retain(|e| match &e.calendar_id {
            Some(id) => !settings.hidden_calendar_ids.contains(id),
            None => true,
        });
    }

    // Apply per-calendar color overrides. Local events keep their own per-event
    // color; Apple events take the calendar's (possibly overridden) color.
    if !settings.calendar_colors.is_empty() {
        for e in events.iter_mut() {
            if e.source != EventSource::Local {
                if let Some(id) = &e.calendar_id {
                    if let Some(c) = settings.calendar_colors.get(id) {
                        e.color = c.clone();
                    }
                }
            }
        }
    }

    events.sort_by_key(|e| e.start);
    Ok(events)
}

// ---------------------------------------------------------------------------
// Local event mutation
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn create_apple_event(calendar_id: String, input: EventInput) -> Result<(), String> {
    tokio::task::spawn_blocking(move || apple::create_event(&calendar_id, &input))
        .await
        .map_err(|e| e.to_string())?
        .map(|_| ())
}

#[tauri::command]
pub async fn update_apple_event(id: String, input: EventInput) -> Result<(), String> {
    let identifier = id.strip_prefix("apple:").unwrap_or(&id).to_string();
    tokio::task::spawn_blocking(move || apple::update_event(&identifier, &input))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn save_event(
    state: State<'_, AppState>,
    input: EventInput,
) -> Result<CalendarEvent, String> {
    let db_path = state.db_path.clone();
    tokio::task::spawn_blocking(move || local::upsert_event(&db_path, input))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_event(state: State<'_, AppState>, id: String) -> Result<(), String> {
    // Apple events are removed via EventKit; everything else is a local row.
    if let Some(identifier) = id.strip_prefix("apple:") {
        let identifier = identifier.to_string();
        return tokio::task::spawn_blocking(move || apple::delete_event(&identifier))
            .await
            .map_err(|e| e.to_string())?;
    }
    let db_path = state.db_path.clone();
    let raw = id.strip_prefix("local:").unwrap_or(&id).to_string();
    tokio::task::spawn_blocking(move || local::delete_event(&db_path, &raw))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}
