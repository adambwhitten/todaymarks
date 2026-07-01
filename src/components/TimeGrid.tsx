import { useEffect, useMemo, useRef, useState } from "react";
import type { CalendarEvent, Settings } from "@/lib/types";
import { DAY_MS, formatHourLabel, formatTime, isToday } from "@/lib/date";
import { isAllDayBlock, layoutDayColumn } from "@/lib/layout";

/** Pixel height of one hour row. */
const HOUR_HEIGHT = 52;
/** Hour scrolled to the top by default (the 8am–5pm working window). */
const DEFAULT_SCROLL_HOUR = 8;

interface TimeGridProps {
  /** 1 day (day view) or 7 days (week view). */
  days: Date[];
  events: CalendarEvent[];
  settings: Settings;
  /** Show the weekday/date column headers (week view). */
  showDayHeaders: boolean;
  onOpenEvent: (event: CalendarEvent) => void;
  onCreate: (day: Date) => void;
  onOpenDay: (day: Date) => void;
}

export function TimeGrid({
  days,
  events,
  settings,
  showDayHeaders,
  onOpenEvent,
  onCreate,
  onOpenDay,
}: TimeGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Land on the working window (8am) whenever the shown range changes.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = DEFAULT_SCROLL_HOUR * HOUR_HEIGHT;
    }
  }, [days[0]?.getTime(), days.length]);

  // Keep the "now" line live.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const hours = useMemo(() => Array.from({ length: 24 }, (_, h) => h), []);

  const allDayByCol = useMemo(
    () =>
      days.map((day) => {
        const s = day.getTime();
        const e = s + DAY_MS;
        return events
          .filter((ev) => isAllDayBlock(ev) && ev.start < e && ev.end > s)
          .sort((a, b) => a.start - b.start);
      }),
    [days, events],
  );
  const hasAllDay = allDayByCol.some((c) => c.length > 0);

  const now = new Date();
  const showNow = days.some((d) => isToday(d));
  const nowTop = ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT;

  const allDayChip = (ev: CalendarEvent) => (
    <div
      key={ev.id}
      className="tg-allday-chip"
      style={{ ["--chip-color" as string]: ev.color }}
      title={ev.title}
      onClick={() => onOpenEvent(ev)}
    >
      <span className="chip-tick" />
      <span className="chip-label">{ev.title}</span>
    </div>
  );

  // The shared scrollable hour grid (gutter of hour labels + day columns).
  const gridScroll = (
    <div className="tg-scroll" ref={scrollRef}>
      <div className="tg-body" style={{ height: 24 * HOUR_HEIGHT }}>
        <div className="tg-gutter">
          {hours.map((h) => (
            <div key={h} className="tg-hourlabel" style={{ top: h * HOUR_HEIGHT }}>
              {h === 0 ? "" : formatHourLabel(h, settings.timeFormat)}
            </div>
          ))}
          {showNow && (
            <div className="tg-nowlabel" style={{ top: nowTop }}>
              {formatTime(now.getTime(), settings.timeFormat)}
            </div>
          )}
        </div>

        <div className="tg-cols">
          {hours.map((h) => (
            <div key={h} className="tg-hline" style={{ top: h * HOUR_HEIGHT }} />
          ))}

          {days.map((day) => {
            const blocks = layoutDayColumn(events, day.getTime(), HOUR_HEIGHT);
            const weekend = day.getDay() === 0 || day.getDay() === 6;
            return (
              <div
                key={day.toISOString()}
                className={
                  "tg-col" +
                  (weekend ? " is-weekend" : "") +
                  (showDayHeaders && isToday(day) ? " is-today" : "")
                }
                onClick={(e) => {
                  if (e.target === e.currentTarget) onCreate(day);
                }}
              >
                {blocks.map((b) => {
                  const compact = b.height < 30;
                  return (
                    <div
                      key={b.event.id}
                      className={"tg-event" + (compact ? " is-compact" : "")}
                      style={{
                        top: b.top,
                        height: b.height,
                        left: `calc(${b.left * 100}% + 2px)`,
                        width: `calc(${b.width * 100}% - 4px)`,
                        ["--accent" as string]: b.event.color,
                      }}
                      title={b.event.title}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenEvent(b.event);
                      }}
                    >
                      <span className="tg-event-tick" />
                      <div className="tg-event-body">
                        <span className="tg-event-title">{b.event.title}</span>
                        {!compact && (
                          <span className="tg-event-time">
                            {formatTime(b.event.start, settings.timeFormat)}
                            {" – "}
                            {formatTime(b.event.end, settings.timeFormat)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {showNow && (
            <div className="tg-now" style={{ top: nowTop }}>
              <span className="tg-now-dot" />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Week: weekday/date headers, a fixed all-day row beneath them, then the grid.
  if (showDayHeaders) {
    return (
      <div className="timegrid is-week">
        <div className="tg-daterow">
          <div className="tg-corner" />
          {days.map((day) => {
            const weekend = day.getDay() === 0 || day.getDay() === 6;
            return (
              <div
                key={day.toISOString()}
                className={
                  "tg-dayhead" +
                  (weekend ? " is-weekend" : "") +
                  (isToday(day) ? " is-today" : "")
                }
                onClick={() => onOpenDay(day)}
                title="Open day"
              >
                <span className="tg-dayname">
                  {day.toLocaleDateString(undefined, { weekday: "short" })}
                </span>
                <span className={"tg-daynum" + (isToday(day) ? " is-today" : "")}>
                  {day.getDate()}
                </span>
              </div>
            );
          })}
        </div>

        {hasAllDay && (
          <div className="tg-alldayrow">
            <div className="tg-allday-label">All day</div>
            {allDayByCol.map((list, ci) => (
              <div
                key={ci}
                className={
                  "tg-allday-col" + (isToday(days[ci]) ? " is-today" : "")
                }
              >
                {list.map(allDayChip)}
              </div>
            ))}
          </div>
        )}

        {gridScroll}
      </div>
    );
  }

  // Day: grid on the left, all-day events in a right column (only when present).
  return (
    <div className="timegrid is-day">
      <div className="tg-day-split">
        <div className="tg-main">{gridScroll}</div>
        {hasAllDay && (
          <div className="tg-allday-side">
            <div className="tg-allday-side-head">All day</div>
            <div className="tg-allday-side-list">
              {allDayByCol[0].map(allDayChip)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
