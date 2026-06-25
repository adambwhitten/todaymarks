//! Shared data types exchanged with the frontend.

use serde::{Deserialize, Serialize};

/// Where an event originated.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EventSource {
    Apple,
    Local,
}

impl EventSource {
    pub fn as_str(&self) -> &'static str {
        match self {
            EventSource::Apple => "apple",
            EventSource::Local => "local",
        }
    }
}

/// A single calendar entry, normalized across every provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEvent {
    pub id: String,
    pub source: EventSource,
    pub calendar_id: Option<String>,
    pub calendar_name: Option<String>,
    pub title: String,
    pub notes: Option<String>,
    pub location: Option<String>,
    /// Unix epoch milliseconds.
    pub start: i64,
    /// Unix epoch milliseconds.
    pub end: i64,
    pub all_day: bool,
    /// Hex color (e.g. "#6366f1").
    pub color: String,
    /// Join/booking URL if any.
    pub url: Option<String>,
    /// Human label like "Google Meet", "Zoom", "Cal.com".
    pub meeting_provider: Option<String>,
    pub editable: bool,
}

/// A calendar (a grouping of events) exposed to the calendar picker.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarInfo {
    pub id: String,
    pub name: String,
    pub color: String,
    pub source: EventSource,
    pub editable: bool,
}

/// Payload for creating / editing a local event.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventInput {
    pub id: Option<String>,
    pub title: String,
    pub notes: Option<String>,
    pub location: Option<String>,
    pub start: i64,
    pub end: i64,
    pub all_day: bool,
    pub color: Option<String>,
    pub url: Option<String>,
}

/// Stable, pleasant color palette.
pub const PALETTE: &[&str] = &[
    "#6366f1", // indigo
    "#0ea5e9", // sky
    "#10b981", // emerald
    "#f59e0b", // amber
    "#ef4444", // red
    "#ec4899", // pink
    "#8b5cf6", // violet
    "#14b8a6", // teal
    "#f97316", // orange
    "#84cc16", // lime
    "#ffffff", // white
];

/// Deterministically pick a palette color from any stable key.
pub fn color_for_key(key: &str) -> String {
    let mut hash: u32 = 2166136261;
    for b in key.bytes() {
        hash ^= b as u32;
        hash = hash.wrapping_mul(16777619);
    }
    PALETTE[(hash as usize) % PALETTE.len()].to_string()
}

/// Best-effort detection of a meeting provider from a URL or text blob.
pub fn detect_meeting_provider(text: &str) -> Option<String> {
    let t = text.to_lowercase();
    if t.contains("meet.google.com") {
        Some("Google Meet".into())
    } else if t.contains("zoom.us") {
        Some("Zoom".into())
    } else if t.contains("teams.microsoft.com") || t.contains("teams.live.com") {
        Some("Microsoft Teams".into())
    } else if t.contains("whereby.com") {
        Some("Whereby".into())
    } else if t.contains("cal.com") {
        Some("Cal.com".into())
    } else {
        None
    }
}
