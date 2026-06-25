//! Minimal debug logging to stderr (visible when the app is run from a terminal).

pub fn log(msg: impl AsRef<str>) {
    eprintln!("[todaymarks] {}", msg.as_ref());
}
