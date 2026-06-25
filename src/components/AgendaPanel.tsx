import type { PointerEvent as ReactPointerEvent } from "react";
import type { CalendarEvent, Settings } from "@/lib/types";
import { formatDayHeading, formatTime, isSameDay, isToday } from "@/lib/date";
import { PlusIcon, VideoIcon, MapPinIcon } from "./Icons";

interface AgendaPanelProps {
  selectedDate: Date;
  events: CalendarEvent[];
  settings: Settings;
  height: number;
  onHeightChange: (h: number) => void;
  onOpenEvent: (event: CalendarEvent) => void;
  onNewEvent: () => void;
  onJoin: (event: CalendarEvent) => void;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function dayEvents(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const startMs = start.getTime();
  const endMs = startMs + 24 * 60 * 60 * 1000;
  return events
    .filter((e) => e.start < endMs && e.end > startMs)
    .sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.start - b.start;
    });
}

export function AgendaPanel({
  selectedDate,
  events,
  settings,
  height,
  onHeightChange,
  onOpenEvent,
  onNewEvent,
  onJoin,
}: AgendaPanelProps) {
  const list = dayEvents(events, selectedDate);

  function onHandleDown(e: ReactPointerEvent) {
    e.preventDefault();
    const startY = e.clientY;
    const startH = height;
    const move = (ev: PointerEvent) => {
      // Dragging up grows the agenda.
      const next = clamp(startH + (startY - ev.clientY), 150, window.innerHeight - 240);
      onHeightChange(next);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
    };
    document.body.style.cursor = "ns-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <section className="agenda" style={{ height }}>
      <div
        className="agenda-resize"
        onPointerDown={onHandleDown}
        title="Drag to resize"
      >
        <div className="agenda-resize-grip" />
      </div>
      <h2 className="agenda-heading">
        {isToday(selectedDate) ? "Today, " : ""}
        {formatDayHeading(selectedDate)}
      </h2>

      <div className="agenda-scroll">
        {list.length === 0 && (
          <div className="agenda-empty">No events scheduled.</div>
        )}
        {list.map((ev) => (
          <AgendaRow
            key={ev.id}
            event={ev}
            settings={settings}
            selectedDate={selectedDate}
            onOpen={() => onOpenEvent(ev)}
            onJoin={() => onJoin(ev)}
          />
        ))}
      </div>

      <div className="agenda-footer">
        <button className="new-event-btn" onClick={onNewEvent}>
          <PlusIcon size={17} />
          New Event
        </button>
      </div>
    </section>
  );
}

function AgendaRow({
  event,
  settings,
  selectedDate,
  onOpen,
  onJoin,
}: {
  event: CalendarEvent;
  settings: Settings;
  selectedDate: Date;
  onOpen: () => void;
  onJoin: () => void;
}) {
  const start = new Date(event.start);
  const end = new Date(event.end);
  const continuesPast = !isSameDay(end, selectedDate) && !event.allDay;
  const startedBefore = !isSameDay(start, selectedDate);

  return (
    <div className="agenda-row" onClick={onOpen}>
      <div className="agenda-time">
        {event.allDay ? (
          <span className="agenda-allday">All day</span>
        ) : (
          <>
            <span className="agenda-time-start">
              {startedBefore ? "···" : formatTime(event.start, settings.timeFormat)}
            </span>
            <span className="agenda-time-end">
              {continuesPast ? "→" : formatTime(event.end, settings.timeFormat)}
            </span>
          </>
        )}
      </div>

      <div className="agenda-bar" style={{ ["--row-color" as string]: event.color }} />

      <div className="agenda-main">
        <div className="agenda-title">{event.title}</div>
        <div className="agenda-meta">
          {event.meetingProvider && (
            <>
              <VideoIcon />
              <span>{event.meetingProvider}</span>
            </>
          )}
          {!event.meetingProvider && event.location && (
            <>
              <MapPinIcon />
              <span>{event.location}</span>
            </>
          )}
          {!event.meetingProvider && !event.location && (
            <span className="source-pill">{event.source}</span>
          )}
        </div>
      </div>

      {event.url && (
        <button
          className="agenda-join"
          onClick={(e) => {
            e.stopPropagation();
            onJoin();
          }}
        >
          <VideoIcon />
          Join
        </button>
      )}
    </div>
  );
}
