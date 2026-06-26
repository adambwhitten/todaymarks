import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { CalendarEvent, Settings } from "@/lib/types";
import { formatDayHeading, formatTime, isSameDay, isToday } from "@/lib/date";
import {
  PlusIcon,
  VideoIcon,
  MapPinIcon,
  AlertIcon,
  XIcon,
  ClockIcon,
} from "./Icons";
import { UndoToast } from "./UndoToast";
import { SnoozeMenu } from "./SnoozeMenu";

const DISMISSED_KEY = "todaymarks.dismissedConflicts";
const SNOOZE_KEY = "todaymarks.conflictSnoozes";

function loadSnoozes(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SNOOZE_KEY) || "{}");
  } catch {
    return {};
  }
}

/** Ids of timed events whose times overlap another timed event that day. */
function findConflictIds(list: CalendarEvent[]): Set<string> {
  const timed = list.filter((e) => !e.allDay);
  const ids = new Set<string>();
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      if (timed[i].start < timed[j].end && timed[i].end > timed[j].start) {
        ids.add(timed[i].id);
        ids.add(timed[j].id);
      }
    }
  }
  return ids;
}

function loadDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

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
  const conflicts = findConflictIds(list);
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed);
  const [snoozes, setSnoozes] = useState<Record<string, number>>(loadSnoozes);
  const [undoId, setUndoId] = useState<string | null>(null);

  // Tick once a minute so snoozed conflicts resurface when their time passes,
  // even if the app is never closed.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60 * 1000);
    return () => clearInterval(t);
  }, []);
  const now = Date.now();

  // Events whose time has passed sink to the bottom, dimmed, marked "Done".
  const isPast = (e: CalendarEvent) => e.end <= now;
  const ordered = [...list].sort((a, b) => {
    const ap = isPast(a);
    const bp = isPast(b);
    if (ap !== bp) return ap ? 1 : -1;
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return a.start - b.start;
  });

  function persist(set: Set<string>) {
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
    } catch {
      /* ignore */
    }
  }

  function dismissConflict(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev).add(id);
      persist(next);
      return next;
    });
    setUndoId(id); // give a 10s window to undo
  }

  function undoDismiss() {
    if (!undoId) return;
    setDismissed((prev) => {
      const next = new Set(prev);
      next.delete(undoId);
      persist(next);
      return next;
    });
    setUndoId(null);
  }

  function snoozeConflict(id: string, untilMs: number) {
    setSnoozes((prev) => {
      const next = { ...prev, [id]: untilMs };
      try {
        localStorage.setItem(SNOOZE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function isConflictVisible(id: string): boolean {
    if (!conflicts.has(id)) return false;
    if (dismissed.has(id)) return false;
    const until = snoozes[id];
    if (until && now < until) return false;
    return true;
  }

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
        {ordered.map((ev) => (
          <AgendaRow
            key={ev.id}
            event={ev}
            settings={settings}
            selectedDate={selectedDate}
            past={isPast(ev)}
            conflict={isConflictVisible(ev.id) && !isPast(ev)}
            onDismissConflict={() => dismissConflict(ev.id)}
            onSnoozeConflict={(until) => snoozeConflict(ev.id, until)}
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

      {undoId && (
        <UndoToast
          message="Conflict dismissed"
          onUndo={undoDismiss}
          onClose={() => setUndoId(null)}
        />
      )}
    </section>
  );
}

function AgendaRow({
  event,
  settings,
  selectedDate,
  past,
  conflict,
  onDismissConflict,
  onSnoozeConflict,
  onOpen,
  onJoin,
}: {
  event: CalendarEvent;
  settings: Settings;
  selectedDate: Date;
  past: boolean;
  conflict: boolean;
  onDismissConflict: () => void;
  onSnoozeConflict: (untilMs: number) => void;
  onOpen: () => void;
  onJoin: () => void;
}) {
  const start = new Date(event.start);
  const end = new Date(event.end);
  const continuesPast = !isSameDay(end, selectedDate) && !event.allDay;
  const startedBefore = !isSameDay(start, selectedDate);
  const snoozeRef = useRef<HTMLButtonElement>(null);
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  return (
    <div
      className={
        "agenda-row" +
        (conflict ? " has-conflict" : "") +
        (past ? " is-past" : "")
      }
      onClick={onOpen}
    >
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
          {conflict && (
            <span className="conflict-pill">
              <AlertIcon size={12} />
              Potential Conflict
              <button
                ref={snoozeRef}
                className="conflict-action"
                title="Remind me later"
                onClick={(e) => {
                  e.stopPropagation();
                  setSnoozeOpen((s) => !s);
                }}
              >
                <ClockIcon size={12} />
              </button>
              <button
                className="conflict-action"
                title="Dismiss"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismissConflict();
                }}
              >
                <XIcon size={12} />
              </button>
            </span>
          )}
          {snoozeOpen && (
            <SnoozeMenu
              anchor={snoozeRef}
              eventStart={event.start}
              onSnooze={(until) => {
                onSnoozeConflict(until);
                setSnoozeOpen(false);
              }}
              onClose={() => setSnoozeOpen(false)}
            />
          )}
        </div>
      </div>

      {past ? (
        <span className="done-pill">Done</span>
      ) : (
        event.url && (
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
        )
      )}
    </div>
  );
}
