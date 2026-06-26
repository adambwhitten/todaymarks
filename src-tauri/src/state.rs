//! Application state: data directory, settings persistence, SQLite path.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    /// Calendar ids the user has hidden from view.
    #[serde(default)]
    pub hidden_calendar_ids: Vec<String>,
    /// User-chosen color overrides, keyed by calendar id -> hex string.
    #[serde(default)]
    pub calendar_colors: HashMap<String, String>,
    /// 0 = Sunday, 1 = Monday.
    pub week_start: u8,
    /// "12h" or "24h".
    pub time_format: String,
    /// Default calendar id for new events (writable Apple calendar or local).
    #[serde(default)]
    pub default_calendar_id: Option<String>,
    /// Default duration (minutes) for new timed events.
    #[serde(default = "default_duration")]
    pub default_duration_minutes: u32,
    /// Fire native notifications for upcoming meetings + conflicts while running.
    #[serde(default = "default_true")]
    pub notifications_enabled: bool,
    /// Minutes before an event starts to notify (0 = at start time).
    #[serde(default = "default_lead")]
    pub reminder_lead_minutes: u32,
    /// Keep running in the menu bar when the window is closed.
    #[serde(default = "default_true")]
    pub menu_bar_mode: bool,
    /// Start Todaymarks automatically at login.
    #[serde(default)]
    pub launch_at_login: bool,
    /// Gist id backing the published ICS feed of the local calendar.
    #[serde(default)]
    pub ics_gist_id: Option<String>,
    /// Public raw URL of the published ICS feed (for Cal.com etc.).
    #[serde(default)]
    pub ics_feed_url: Option<String>,
    /// Show the (experimental) "Calendar Feed" publishing UI. Off by default —
    /// not shipped to users yet.
    #[serde(default)]
    pub feed_enabled: bool,
}

fn default_duration() -> u32 {
    60
}
fn default_true() -> bool {
    true
}
fn default_lead() -> u32 {
    5
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            hidden_calendar_ids: Vec::new(),
            calendar_colors: HashMap::new(),
            week_start: 0,
            time_format: "12h".to_string(),
            default_calendar_id: None,
            default_duration_minutes: 60,
            notifications_enabled: true,
            reminder_lead_minutes: 5,
            menu_bar_mode: true,
            launch_at_login: false,
            ics_gist_id: None,
            ics_feed_url: None,
            feed_enabled: false,
        }
    }
}

impl Settings {
    /// Resolve the effective color for a calendar id, honoring overrides.
    pub fn color_for(&self, calendar_id: &Option<String>, fallback: &str) -> String {
        match calendar_id {
            Some(id) => self
                .calendar_colors
                .get(id)
                .cloned()
                .unwrap_or_else(|| fallback.to_string()),
            None => fallback.to_string(),
        }
    }
}

pub struct AppState {
    pub data_dir: PathBuf,
    pub db_path: PathBuf,
    pub settings_path: PathBuf,
    pub settings: Mutex<Settings>,
}

impl AppState {
    pub fn new() -> anyhow::Result<Self> {
        let base = dirs::data_dir()
            .or_else(dirs::config_dir)
            .unwrap_or_else(|| PathBuf::from("."));
        let data_dir = base.join("com.todaymarks.app");
        std::fs::create_dir_all(&data_dir)?;

        let db_path = data_dir.join("todaymarks.db");
        let settings_path = data_dir.join("settings.json");

        let settings = match std::fs::read_to_string(&settings_path) {
            Ok(raw) => serde_json::from_str(&raw).unwrap_or_default(),
            Err(_) => Settings::default(),
        };

        Ok(AppState {
            data_dir,
            db_path,
            settings_path,
            settings: Mutex::new(settings),
        })
    }

    pub fn get_settings(&self) -> Settings {
        self.settings.lock().expect("settings lock").clone()
    }

    pub fn save_settings(&self, next: Settings) -> anyhow::Result<Settings> {
        let json = serde_json::to_string_pretty(&next)?;
        std::fs::write(&self.settings_path, json)?;
        *self.settings.lock().expect("settings lock") = next.clone();
        Ok(next)
    }
}
