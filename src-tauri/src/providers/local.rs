//! Local events provider, backed by SQLite. These are events the user
//! creates inside Todaymarks itself ("New Event").

use crate::models::{color_for_key, detect_meeting_provider, CalendarEvent, EventInput, EventSource};
use rusqlite::Connection;
use std::path::Path;
use uuid::Uuid;

const LOCAL_CALENDAR_ID: &str = "local:default";
const LOCAL_CALENDAR_NAME: &str = "Todaymarks";

fn open(db_path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(db_path)?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS events (
            id          TEXT PRIMARY KEY,
            title       TEXT NOT NULL,
            notes       TEXT,
            location    TEXT,
            start_ms    INTEGER NOT NULL,
            end_ms      INTEGER NOT NULL,
            all_day     INTEGER NOT NULL DEFAULT 0,
            color       TEXT,
            url         TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_events_range ON events(start_ms, end_ms);",
    )?;
    Ok(conn)
}

fn row_to_event(
    id: String,
    title: String,
    notes: Option<String>,
    location: Option<String>,
    start: i64,
    end: i64,
    all_day: bool,
    color: Option<String>,
    url: Option<String>,
) -> CalendarEvent {
    let provider_hint = format!(
        "{} {} {}",
        url.clone().unwrap_or_default(),
        location.clone().unwrap_or_default(),
        notes.clone().unwrap_or_default()
    );
    CalendarEvent {
        color: color.unwrap_or_else(|| color_for_key(LOCAL_CALENDAR_ID)),
        meeting_provider: detect_meeting_provider(&provider_hint),
        id,
        source: EventSource::Local,
        calendar_id: Some(LOCAL_CALENDAR_ID.to_string()),
        calendar_name: Some(LOCAL_CALENDAR_NAME.to_string()),
        title,
        notes,
        location,
        start,
        end,
        all_day,
        url,
        editable: true,
    }
}

pub fn list_events(db_path: &Path, start_ms: i64, end_ms: i64) -> anyhow::Result<Vec<CalendarEvent>> {
    let conn = open(db_path)?;
    let mut stmt = conn.prepare(
        "SELECT id, title, notes, location, start_ms, end_ms, all_day, color, url
         FROM events
         WHERE start_ms < ?2 AND end_ms > ?1
         ORDER BY start_ms ASC",
    )?;
    let rows = stmt.query_map([start_ms, end_ms], |r| {
        Ok(row_to_event(
            r.get(0)?,
            r.get(1)?,
            r.get(2)?,
            r.get(3)?,
            r.get(4)?,
            r.get(5)?,
            r.get::<_, i64>(6)? != 0,
            r.get(7)?,
            r.get(8)?,
        ))
    })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn upsert_event(db_path: &Path, input: EventInput) -> anyhow::Result<CalendarEvent> {
    let conn = open(db_path)?;
    let id = input.id.clone().unwrap_or_else(|| Uuid::new_v4().to_string());
    let color = input
        .color
        .clone()
        .unwrap_or_else(|| color_for_key(LOCAL_CALENDAR_ID));
    conn.execute(
        "INSERT INTO events (id, title, notes, location, start_ms, end_ms, all_day, color, url)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(id) DO UPDATE SET
            title=excluded.title, notes=excluded.notes, location=excluded.location,
            start_ms=excluded.start_ms, end_ms=excluded.end_ms, all_day=excluded.all_day,
            color=excluded.color, url=excluded.url",
        rusqlite::params![
            id,
            input.title,
            input.notes,
            input.location,
            input.start,
            input.end,
            input.all_day as i64,
            color,
            input.url,
        ],
    )?;
    Ok(row_to_event(
        id,
        input.title,
        input.notes,
        input.location,
        input.start,
        input.end,
        input.all_day,
        Some(color),
        input.url,
    ))
}

pub fn delete_event(db_path: &Path, id: &str) -> anyhow::Result<()> {
    let conn = open(db_path)?;
    conn.execute("DELETE FROM events WHERE id = ?1", [id])?;
    Ok(())
}

pub fn local_calendar() -> (String, String, String) {
    (
        LOCAL_CALENDAR_ID.to_string(),
        LOCAL_CALENDAR_NAME.to_string(),
        color_for_key(LOCAL_CALENDAR_ID),
    )
}
