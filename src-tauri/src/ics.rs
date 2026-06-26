//! Generate an iCalendar (.ics) feed from local events.

use crate::models::CalendarEvent;
use chrono::{DateTime, Utc};

/// Escape a value per RFC 5545 (TEXT type).
fn esc(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace(';', "\\;")
        .replace(',', "\\,")
        .replace('\n', "\\n")
        .replace('\r', "")
}

fn utc(ms: i64) -> DateTime<Utc> {
    DateTime::from_timestamp_millis(ms).unwrap_or_else(Utc::now)
}

/// Build a VCALENDAR string from the given events.
pub fn generate(calendar_name: &str, events: &[CalendarEvent]) -> String {
    let now = Utc::now().format("%Y%m%dT%H%M%SZ").to_string();
    let mut out = String::new();
    out.push_str("BEGIN:VCALENDAR\r\n");
    out.push_str("VERSION:2.0\r\n");
    out.push_str("PRODID:-//Todaymarks//Calendar Feed//EN\r\n");
    out.push_str("CALSCALE:GREGORIAN\r\n");
    out.push_str("METHOD:PUBLISH\r\n");
    out.push_str(&format!("X-WR-CALNAME:{}\r\n", esc(calendar_name)));

    for ev in events {
        out.push_str("BEGIN:VEVENT\r\n");
        out.push_str(&format!("UID:{}@todaymarks\r\n", ev.id));
        out.push_str(&format!("DTSTAMP:{now}\r\n"));

        if ev.all_day {
            let start = utc(ev.start).format("%Y%m%d").to_string();
            // DTEND is exclusive for all-day events.
            let end = utc(ev.end).format("%Y%m%d").to_string();
            out.push_str(&format!("DTSTART;VALUE=DATE:{start}\r\n"));
            out.push_str(&format!("DTEND;VALUE=DATE:{end}\r\n"));
        } else {
            out.push_str(&format!(
                "DTSTART:{}\r\n",
                utc(ev.start).format("%Y%m%dT%H%M%SZ")
            ));
            out.push_str(&format!("DTEND:{}\r\n", utc(ev.end).format("%Y%m%dT%H%M%SZ")));
        }

        out.push_str(&format!("SUMMARY:{}\r\n", esc(&ev.title)));
        if let Some(notes) = &ev.notes {
            out.push_str(&format!("DESCRIPTION:{}\r\n", esc(notes)));
        }
        if let Some(loc) = &ev.location {
            out.push_str(&format!("LOCATION:{}\r\n", esc(loc)));
        }
        if let Some(url) = &ev.url {
            out.push_str(&format!("URL:{}\r\n", esc(url)));
        }
        out.push_str("END:VEVENT\r\n");
    }

    out.push_str("END:VCALENDAR\r\n");
    out
}
