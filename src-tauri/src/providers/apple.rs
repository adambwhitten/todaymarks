//! Apple Calendar provider via native EventKit (macOS only).

use crate::models::{CalendarEvent, EventInput};

/// Authorization state for the Apple Calendar.
pub fn authorization_status() -> String {
    #[cfg(target_os = "macos")]
    {
        mac::authorization_status()
    }
    #[cfg(not(target_os = "macos"))]
    {
        "unsupported".to_string()
    }
}

/// Prompt for (or confirm) full calendar access. Returns true if granted.
pub fn request_access() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        mac::request_access()
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Apple Calendar is only available on macOS".to_string())
    }
}

pub fn list_events(_start_ms: i64, _end_ms: i64) -> Result<Vec<CalendarEvent>, String> {
    #[cfg(target_os = "macos")]
    {
        mac::list_events(_start_ms, _end_ms)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(Vec::new())
    }
}

pub fn list_calendars() -> Result<Vec<(String, String, String, bool)>, String> {
    #[cfg(target_os = "macos")]
    {
        mac::list_calendars()
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(Vec::new())
    }
}

/// Create an event in the given Apple/EventKit calendar. Returns its identifier.
pub fn create_event(_calendar_id: &str, _input: &EventInput) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        mac::create_event(_calendar_id, _input)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Apple Calendar is only available on macOS".to_string())
    }
}

/// Update an existing Apple/EventKit event by its identifier.
pub fn update_event(_identifier: &str, _input: &EventInput) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        mac::update_event(_identifier, _input)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Apple Calendar is only available on macOS".to_string())
    }
}

/// Delete an Apple/EventKit event by its identifier.
pub fn delete_event(_identifier: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        mac::delete_event(_identifier)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Apple Calendar is only available on macOS".to_string())
    }
}

#[cfg(target_os = "macos")]
mod mac {
    use crate::models::{color_for_key, detect_meeting_provider, CalendarEvent, EventSource};
    use block2::RcBlock;
    use objc2::runtime::Bool;
    use crate::models::EventInput;
    use objc2::rc::Retained;
    use objc2_event_kit::{
        EKAuthorizationStatus, EKCalendar, EKEntityType, EKEvent, EKEventStore, EKSpan,
    };
    use objc2_foundation::{NSDate, NSError, NSString, NSURL};
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::{mpsc, Mutex, OnceLock};
    use std::time::Duration;

    /// Whether the read store has been recreated since access was granted. The
    /// store caches its access state at creation, so if it was made while access
    /// was undetermined it can't see events even once we're authorized.
    static READ_SYNCED: AtomicBool = AtomicBool::new(false);

    /// EventKit limits the number of `EKEventStore` instances per process, so we
    /// keep long-lived stores and reuse them. We use TWO: one for reading events
    /// and one dedicated to the permission request — so a pending permission
    /// dialog can never block event reads.
    struct StoreHandle(Retained<EKEventStore>);
    // SAFETY: EKEventStore is documented as safe to use across threads, and all
    // access is serialized through the Mutex below.
    unsafe impl Send for StoreHandle {}

    fn read_store() -> &'static Mutex<StoreHandle> {
        static STORE: OnceLock<Mutex<StoreHandle>> = OnceLock::new();
        STORE.get_or_init(|| Mutex::new(StoreHandle(unsafe { EKEventStore::new() })))
    }

    fn request_store() -> &'static Mutex<StoreHandle> {
        static STORE: OnceLock<Mutex<StoreHandle>> = OnceLock::new();
        STORE.get_or_init(|| Mutex::new(StoreHandle(unsafe { EKEventStore::new() })))
    }

    /// After access is granted, the existing read store is stale — EventKit only
    /// picks up newly granted access on a freshly created store. Replace it.
    fn refresh_read_store() {
        if let Ok(mut guard) = read_store().lock() {
            guard.0 = unsafe { EKEventStore::new() };
            crate::debug::log("refresh_read_store: recreated read store");
        }
    }

    /// Ensure the read store reflects current access. Recreates it once after we
    /// first observe authorized status (handles a grant that arrived after a
    /// timed-out request, or a store created before access was determined).
    fn sync_read_store_if_needed() {
        if authorization_status() == "authorized" && !READ_SYNCED.swap(true, Ordering::SeqCst) {
            refresh_read_store();
        }
    }

    fn nsstring(opt: Option<objc2::rc::Retained<NSString>>) -> Option<String> {
        opt.map(|s| s.to_string()).filter(|s| !s.is_empty())
    }

    pub fn authorization_status() -> String {
        let status = unsafe { EKEventStore::authorizationStatusForEntityType(EKEntityType::Event) };
        match status {
            EKAuthorizationStatus::NotDetermined => "notDetermined",
            EKAuthorizationStatus::Restricted => "restricted",
            EKAuthorizationStatus::Denied => "denied",
            EKAuthorizationStatus::FullAccess => "authorized",
            EKAuthorizationStatus::WriteOnly => "writeOnly",
            _ => "unknown",
        }
        .to_string()
    }

    pub fn request_access() -> Result<bool, String> {
        let (tx, rx) = mpsc::channel::<bool>();
        let handler = RcBlock::new(move |granted: Bool, err: *mut NSError| {
            if !err.is_null() {
                let msg = unsafe { (*err).localizedDescription() }.to_string();
                eprintln!("[todaymarks] apple request_access error: {msg}");
            }
            let _ = tx.send(granted.as_bool());
        });
        let handler_ptr: *mut block2::Block<dyn Fn(Bool, *mut NSError)> =
            (&*handler as *const block2::Block<dyn Fn(Bool, *mut NSError)>).cast_mut();

        // Uses a dedicated request store so a pending dialog never blocks reads.
        {
            let guard = request_store().lock().map_err(|_| "store lock".to_string())?;
            unsafe {
                guard.0.requestFullAccessToEventsWithCompletion(handler_ptr);
            }
        }

        let result = rx
            .recv_timeout(Duration::from_secs(120))
            .map_err(|_| "Timed out waiting for calendar permission".to_string());
        crate::debug::log(format!(
            "request_access: result={result:?}, status now={}",
            authorization_status()
        ));
        // If granted, recreate the read store so subsequent reads can see events.
        if matches!(result, Ok(true)) {
            READ_SYNCED.store(true, Ordering::SeqCst);
            refresh_read_store();
        }
        result
    }

    pub fn list_calendars() -> Result<Vec<(String, String, String, bool)>, String> {
        sync_read_store_if_needed();
        let guard = read_store().lock().map_err(|_| "store lock".to_string())?;
        let store = &guard.0;
        let calendars = unsafe { store.calendarsForEntityType(EKEntityType::Event) };
        let mut out = Vec::new();
        for i in 0..calendars.count() {
            let cal = calendars.objectAtIndex(i);
            let (id, name, color, editable) = describe_calendar(&cal);
            out.push((id, name, color, editable));
        }
        Ok(out)
    }

    pub fn create_event(calendar_id: &str, input: &EventInput) -> Result<String, String> {
        let guard = read_store().lock().map_err(|_| "store lock".to_string())?;
        let store = &guard.0;

        let raw_id = calendar_id.strip_prefix("apple:").unwrap_or(calendar_id);
        let cal = unsafe { store.calendarWithIdentifier(&NSString::from_str(raw_id)) }
            .ok_or_else(|| "Calendar not found".to_string())?;
        if !unsafe { cal.allowsContentModifications() } {
            return Err("That calendar is read-only and can't accept new events.".to_string());
        }

        let event = unsafe { EKEvent::eventWithEventStore(store) };
        unsafe {
            event.setTitle(Some(&NSString::from_str(&input.title)));
            event.setStartDate(Some(&NSDate::dateWithTimeIntervalSince1970(
                input.start as f64 / 1000.0,
            )));
            event.setEndDate(Some(&NSDate::dateWithTimeIntervalSince1970(
                input.end as f64 / 1000.0,
            )));
            event.setAllDay(input.all_day);
            if let Some(notes) = &input.notes {
                event.setNotes(Some(&NSString::from_str(notes)));
            }
            if let Some(location) = &input.location {
                event.setLocation(Some(&NSString::from_str(location)));
            }
            if let Some(url) = &input.url {
                if let Some(nsurl) = NSURL::URLWithString(&NSString::from_str(url)) {
                    event.setURL(Some(&nsurl));
                }
            }
            event.setCalendar(Some(&cal));
        }

        unsafe { store.saveEvent_span_error(&event, EKSpan::ThisEvent) }
            .map_err(|e| e.localizedDescription().to_string())?;

        let id = unsafe { nsstring(event.eventIdentifier()) }.unwrap_or_default();
        crate::debug::log(format!("create_event: saved apple event id={id}"));
        Ok(id)
    }

    fn describe_calendar(cal: &EKCalendar) -> (String, String, String, bool) {
        let id = unsafe { nsstring(Some(cal.calendarIdentifier())) }
            .unwrap_or_else(|| "apple:unknown".to_string());
        let name =
            unsafe { nsstring(Some(cal.title())) }.unwrap_or_else(|| "Calendar".to_string());
        let editable = unsafe { cal.allowsContentModifications() };
        let color = color_for_key(&id);
        (format!("apple:{id}"), name, color, editable)
    }

    pub fn list_events(start_ms: i64, end_ms: i64) -> Result<Vec<CalendarEvent>, String> {
        sync_read_store_if_needed();
        let guard = read_store().lock().map_err(|_| "store lock".to_string())?;
        let store = &guard.0;
        let start_date = NSDate::dateWithTimeIntervalSince1970(start_ms as f64 / 1000.0);
        let end_date = NSDate::dateWithTimeIntervalSince1970(end_ms as f64 / 1000.0);

        let predicate = unsafe {
            store.predicateForEventsWithStartDate_endDate_calendars(&start_date, &end_date, None)
        };
        let events = unsafe { store.eventsMatchingPredicate(&predicate) };

        let mut out = Vec::new();
        for i in 0..events.count() {
            let ev = events.objectAtIndex(i);
            if let Some(event) = convert_event(&ev) {
                out.push(event);
            }
        }
        out.sort_by_key(|e| e.start);
        Ok(out)
    }

    fn convert_event(ev: &EKEvent) -> Option<CalendarEvent> {
        let start = unsafe { ev.startDate() };
        let end = unsafe { ev.endDate() };
        let start_ms = (start.timeIntervalSince1970() * 1000.0) as i64;
        let end_ms = (end.timeIntervalSince1970() * 1000.0) as i64;

        let title = {
            let t = unsafe { ev.title() }.to_string();
            if t.is_empty() {
                "(No title)".to_string()
            } else {
                t
            }
        };
        let notes = unsafe { nsstring(ev.notes()) };
        let location = unsafe { nsstring(ev.location()) };
        let all_day = unsafe { ev.isAllDay() };

        let url = unsafe { ev.URL() }
            .and_then(|u| u.absoluteString())
            .map(|s| s.to_string());

        let identifier = unsafe { nsstring(ev.eventIdentifier()) }
            .unwrap_or_else(|| format!("apple-{start_ms}"));

        let (calendar_id, calendar_name, color, editable) = match unsafe { ev.calendar() } {
            Some(cal) => {
                let (id, name, color, editable) = describe_calendar(&cal);
                (Some(id), Some(name), color, editable)
            }
            None => (None, None, color_for_key("apple:default"), false),
        };

        let hint = format!(
            "{} {} {}",
            url.clone().unwrap_or_default(),
            location.clone().unwrap_or_default(),
            notes.clone().unwrap_or_default()
        );

        Some(CalendarEvent {
            id: format!("apple:{identifier}"),
            source: EventSource::Apple,
            calendar_id,
            calendar_name,
            title,
            notes,
            location,
            start: start_ms,
            end: end_ms,
            all_day,
            color,
            url,
            meeting_provider: detect_meeting_provider(&hint),
            editable,
        })
    }

    pub fn update_event(identifier: &str, input: &EventInput) -> Result<(), String> {
        let guard = read_store().lock().map_err(|_| "store lock".to_string())?;
        let store = &guard.0;
        let event = unsafe { store.eventWithIdentifier(&NSString::from_str(identifier)) }
            .ok_or_else(|| "Event no longer exists".to_string())?;
        unsafe {
            event.setTitle(Some(&NSString::from_str(&input.title)));
            event.setStartDate(Some(&NSDate::dateWithTimeIntervalSince1970(
                input.start as f64 / 1000.0,
            )));
            event.setEndDate(Some(&NSDate::dateWithTimeIntervalSince1970(
                input.end as f64 / 1000.0,
            )));
            event.setAllDay(input.all_day);
            event.setNotes(input.notes.as_deref().map(NSString::from_str).as_deref());
            event.setLocation(input.location.as_deref().map(NSString::from_str).as_deref());
            if let Some(url) = &input.url {
                if let Some(nsurl) = NSURL::URLWithString(&NSString::from_str(url)) {
                    event.setURL(Some(&nsurl));
                }
            }
        }
        unsafe { store.saveEvent_span_error(&event, EKSpan::ThisEvent) }
            .map_err(|e| e.localizedDescription().to_string())?;
        Ok(())
    }

    pub fn delete_event(identifier: &str) -> Result<(), String> {
        let guard = read_store().lock().map_err(|_| "store lock".to_string())?;
        let store = &guard.0;
        let event = unsafe { store.eventWithIdentifier(&NSString::from_str(identifier)) }
            .ok_or_else(|| "Event no longer exists".to_string())?;
        unsafe { store.removeEvent_span_error(&event, EKSpan::ThisEvent) }
            .map_err(|e| e.localizedDescription().to_string())?;
        Ok(())
    }
}
