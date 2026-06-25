//! Calendar data providers. Each provider normalizes its source into the shared
//! `CalendarEvent` shape so the frontend never has to special-case a source.

pub mod apple;
pub mod local;
