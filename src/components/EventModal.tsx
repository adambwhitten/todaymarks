import { useState } from "react";
import type { CalendarEvent, CalendarInfo, EventInput } from "@/lib/types";
import { formatTime } from "@/lib/date";
import { api } from "@/lib/api";
import { extractUrls, shortenUrl } from "@/lib/links";
import { DateTimeField } from "./DateTimeField";
import {
  XIcon,
  VideoIcon,
  MapPinIcon,
  ClockIcon,
  NoteIcon,
  LinkIcon,
} from "./Icons";

/** Round a timestamp up to the next 30-minute boundary. */
function roundUpTo30(ms: number): { h: number; m: number } {
  const d = new Date(ms);
  d.setSeconds(0, 0);
  const m = d.getMinutes();
  if (m === 0 || m === 30) return { h: d.getHours(), m };
  if (m < 30) return { h: d.getHours(), m: 30 };
  const n = new Date(d.getTime() + (60 - m) * 60 * 1000);
  return { h: n.getHours(), m: 0 };
}

/** Clickable links extracted from text, opened in the external browser. */
function LinkChips({ text }: { text: string | null | undefined }) {
  const urls = extractUrls(text);
  if (urls.length === 0) return null;
  return (
    <div className="link-chips">
      {urls.map((u) => (
        <button key={u} className="link-chip" onClick={() => api.openExternal(u)}>
          <LinkIcon size={13} />
          <span>{shortenUrl(u)}</span>
        </button>
      ))}
    </div>
  );
}

interface EventModalProps {
  /** Existing event to view/edit, or null for a brand new one. */
  event: CalendarEvent | null;
  /** Default date (ms at local midnight) for a new event. */
  defaultDate: number;
  calendars: CalendarInfo[];
  defaultCalendarId: string | null;
  defaultDurationMinutes: number;
  onClose: () => void;
  onSave: (input: EventInput, calendarId: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onJoin: (url: string) => void;
  timeFormat: "12h" | "24h";
}

function toDateInput(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toTimeInput(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function combine(dateStr: string, timeStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
}

export function EventModal({
  event,
  defaultDate,
  calendars,
  defaultCalendarId,
  defaultDurationMinutes,
  onClose,
  onSave,
  onDelete,
  onJoin,
  timeFormat,
}: EventModalProps) {
  const isReadOnly = event != null && !event.editable;
  if (isReadOnly && event) {
    return <ReadOnlyView event={event} onClose={onClose} onJoin={onJoin} timeFormat={timeFormat} />;
  }

  return (
    <EditView
      event={event}
      defaultDate={defaultDate}
      calendars={calendars}
      defaultCalendarId={defaultCalendarId}
      defaultDurationMinutes={defaultDurationMinutes}
      timeFormat={timeFormat}
      onClose={onClose}
      onSave={onSave}
      onDelete={onDelete}
    />
  );
}

function ReadOnlyView({
  event,
  onClose,
  onJoin,
  timeFormat,
}: {
  event: CalendarEvent;
  onClose: () => void;
  onJoin: (url: string) => void;
  timeFormat: "12h" | "24h";
}) {
  const start = new Date(event.start);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{event.title}</div>
          <button className="icon-btn" onClick={onClose}>
            <XIcon />
          </button>
        </div>
        <div className="modal-body">
          <div className="status-line">
            <ClockIcon />
            <span>
              {start.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
              {!event.allDay && (
                <>
                  {" · "}
                  {formatTime(event.start, timeFormat)} –{" "}
                  {formatTime(event.end, timeFormat)}
                </>
              )}
              {event.allDay && " · All day"}
            </span>
          </div>
          {event.meetingProvider && (
            <div className="status-line">
              <VideoIcon />
              <span>{event.meetingProvider}</span>
            </div>
          )}
          {event.location && (
            <div className="status-line">
              <MapPinIcon />
              <span>{event.location}</span>
            </div>
          )}
          {event.calendarName && (
            <div className="status-line status-muted">
              <span
                className="cal-dot"
                style={{ background: event.color }}
              />
              <span>{event.calendarName}</span>
            </div>
          )}
          {event.notes && (
            <div className="field-hint" style={{ whiteSpace: "pre-wrap" }}>
              {event.notes}
            </div>
          )}
          <LinkChips text={`${event.notes ?? ""} ${event.location ?? ""}`} />
          <div className="field-hint">
            Synced from Apple Calendar · read-only here.
          </div>
        </div>
        <div className="modal-footer">
          {event.url && (
            <button className="btn btn-primary" onClick={() => onJoin(event.url!)}>
              Open / Join
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function EditView({
  event,
  defaultDate,
  calendars,
  defaultCalendarId,
  defaultDurationMinutes,
  timeFormat,
  onClose,
  onSave,
  onDelete,
}: {
  event: CalendarEvent | null;
  defaultDate: number;
  calendars: CalendarInfo[];
  defaultCalendarId: string | null;
  defaultDurationMinutes: number;
  timeFormat: "12h" | "24h";
  onClose: () => void;
  onSave: (input: EventInput, calendarId: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  // Only calendars we can write to (writable Apple calendars + local Todaymarks).
  const writable = calendars.filter((c) => c.editable);
  // New events default to the next 30-minute slot from now, on the chosen day.
  const initialStart =
    event?.start ??
    (() => {
      const { h, m } = roundUpTo30(Date.now());
      return new Date(new Date(defaultDate).setHours(h, m, 0, 0)).getTime();
    })();
  const initialEnd =
    event?.end ?? initialStart + defaultDurationMinutes * 60 * 1000;

  const initialCalendar =
    event?.calendarId ??
    (defaultCalendarId && writable.some((c) => c.id === defaultCalendarId)
      ? defaultCalendarId
      : writable[0]?.id ?? "local:default");

  const [title, setTitle] = useState(event?.title ?? "");
  const [calendarId, setCalendarId] = useState(initialCalendar);
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [date, setDate] = useState(toDateInput(initialStart));
  const [startTime, setStartTime] = useState(toTimeInput(initialStart));
  const [endTime, setEndTime] = useState(toTimeInput(initialEnd));
  const [location, setLocation] = useState(event?.location ?? "");
  const [url, setUrl] = useState(event?.url ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [saving, setSaving] = useState(false);

  // Existing local events stay on their calendar; only new events choose one.
  const showCalendarPicker = event == null && writable.length > 0;
  const canSave = title.trim().length > 0 && !saving;

  const dotColor =
    calendars.find((c) => c.id === calendarId)?.color ?? event?.color ?? "var(--accent)";
  const calendarName =
    calendars.find((c) => c.id === calendarId)?.name ?? event?.calendarName ?? null;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    const start = allDay ? combine(date, "00:00") : combine(date, startTime);
    const end = allDay
      ? combine(date, "00:00") + 24 * 60 * 60 * 1000
      : combine(date, endTime);
    const input: EventInput = {
      id: event?.id ?? null,
      title: title.trim(),
      notes: notes.trim() || null,
      location: location.trim() || null,
      url: url.trim() || null,
      start,
      end: end > start ? end : start + 30 * 60 * 1000,
      allDay,
      // Events inherit their calendar's color.
      color: null,
    };
    try {
      await onSave(input, calendarId);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal event-modal" onClick={(e) => e.stopPropagation()}>
        <div className="event-head">
          <span className="event-head-dot" style={{ background: dotColor }} />
          <input
            className="event-title-input"
            placeholder="Add title"
            value={title}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSave();
            }}
          />
          <button className="icon-btn" onClick={onClose}>
            <XIcon />
          </button>
        </div>

        <div className="event-body">
          <div className="efield-group">
            {showCalendarPicker ? (
              <label className="efield">
                <span className="efield-dot" style={{ background: dotColor }} />
                <select
                  className="efield-select"
                  value={calendarId}
                  onChange={(e) => setCalendarId(e.target.value)}
                >
                  {writable.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : calendarName ? (
              <div className="efield">
                <span className="efield-dot" style={{ background: dotColor }} />
                <span className="efield-static">{calendarName}</span>
              </div>
            ) : null}

            <DateTimeField
              date={date}
              startTime={startTime}
              endTime={endTime}
              allDay={allDay}
              timeFormat={timeFormat}
              onDate={setDate}
              onStart={setStartTime}
              onEnd={setEndTime}
            />

            <div className="efield is-toggle" onClick={() => setAllDay(!allDay)}>
              <span className="efield-label">All-day</span>
              <span className={"switch" + (allDay ? " is-on" : "")}>
                <span className="switch-knob" />
              </span>
            </div>
          </div>

          <div className="efield-group">
            <div className="efield">
              <MapPinIcon size={16} className="efield-icon" />
              <input
                className="efield-input"
                placeholder="Add location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="efield">
              <LinkIcon size={16} className="efield-icon" />
              <input
                className="efield-input"
                placeholder="Add meeting URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              {url.trim() && (
                <button
                  className="efield-open"
                  title="Open link"
                  onClick={() => api.openExternal(url.trim())}
                >
                  Open
                </button>
              )}
            </div>
            <div className="efield is-top">
              <NoteIcon size={16} className="efield-icon" />
              <div className="efield-notes-wrap">
                <textarea
                  className="efield-input efield-notes"
                  placeholder="Notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <LinkChips text={notes} />
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          {event && (
            <button
              className="btn btn-danger"
              onClick={async () => {
                await onDelete(event.id);
                onClose();
              }}
            >
              Delete
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!canSave} onClick={handleSave}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
