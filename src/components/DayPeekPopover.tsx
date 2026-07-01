import { useEffect, useRef } from "react";
import type { CalendarEvent } from "@/lib/types";
import { formatDayHeading, formatTime } from "@/lib/date";

interface DayPeekPopoverProps {
  day: Date;
  /** All of the day's events, already sorted (all-day first, then by start). */
  events: CalendarEvent[];
  timeFormat: "12h" | "24h";
  /** Viewport-space anchor (typically the clicked "+N" element's rect). */
  anchor: { x: number; y: number };
  onOpenEvent: (event: CalendarEvent) => void;
  onClose: () => void;
}

const WIDTH = 244;
const MAX_HEIGHT = 320;

export function DayPeekPopover({
  day,
  events,
  timeFormat,
  anchor,
  onOpenEvent,
  onClose,
}: DayPeekPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const left = Math.max(12, Math.min(anchor.x, window.innerWidth - WIDTH - 12));
  const top = Math.max(
    12,
    Math.min(anchor.y, window.innerHeight - MAX_HEIGHT - 12),
  );

  return (
    <div
      ref={ref}
      className="day-peek"
      style={{ left, top, width: WIDTH }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="day-peek-head">{formatDayHeading(day)}</div>
      <div className="day-peek-list">
        {events.map((ev) => (
          <div
            key={ev.id}
            className="day-peek-row"
            style={{ ["--chip-color" as string]: ev.color }}
            onClick={() => {
              onOpenEvent(ev);
              onClose();
            }}
          >
            <span className="chip-tick" />
            <span className="day-peek-title">{ev.title}</span>
            <span className="day-peek-time">
              {ev.allDay ? "all-day" : formatTime(ev.start, timeFormat)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
