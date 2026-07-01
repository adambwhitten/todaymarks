import { useEffect, useMemo, useRef, useState } from "react";
import type { CalendarEvent } from "@/lib/types";
import { DAY_MS, isSameDay, isSameMonth, isToday } from "@/lib/date";
import { layoutWeek } from "@/lib/layout";
import { DayPeekPopover } from "./DayPeekPopover";

/** Approximate height of one chip / "+N" line, in px. */
const LINE_HEIGHT = 20;

interface WeekRowProps {
  weekDays: Date[];
  viewDate: Date;
  selectedDate: Date;
  events: CalendarEvent[];
  timeFormat: "12h" | "24h";
  onSelectDay: (day: Date) => void;
  onOpenEvent: (event: CalendarEvent) => void;
}

export function WeekRow({
  weekDays,
  viewDate,
  selectedDate,
  events,
  timeFormat,
  onSelectDay,
  onOpenEvent,
}: WeekRowProps) {
  const layout = useMemo(() => layoutWeek(weekDays, events), [weekDays, events]);
  const selectedCol = weekDays.findIndex((d) => isSameDay(d, selectedDate));

  // "+N" peek popover: which day's list is open, and where to anchor it.
  const [peek, setPeek] = useState<{ day: Date; x: number; y: number } | null>(
    null,
  );
  const peekEvents = useMemo(() => {
    if (!peek) return [];
    const s = peek.day.getTime();
    const e = s + DAY_MS;
    return events
      .filter((ev) => ev.start < e && ev.end > s)
      .sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return a.start - b.start;
      });
  }, [peek, events]);

  // Measure the per-day event band so we show exactly as many chips as fit and
  // overflow the rest into "+N" — at any window size, with no mid-line clipping.
  const singlesRef = useRef<HTMLDivElement>(null);
  const [budget, setBudget] = useState(3);
  useEffect(() => {
    const el = singlesRef.current;
    if (!el) return;
    const update = () => {
      setBudget(Math.max(1, Math.floor(el.clientHeight / LINE_HEIGHT)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="week">
      {/* Selected-day column highlight (sits behind the content) */}
      {selectedCol >= 0 && (
        <div
          className="week-selection"
          style={{
            left: `calc(${selectedCol} * (100% / 7))`,
            width: "calc(100% / 7)",
          }}
        />
      )}

      {/* Day numbers */}
      <div className="week-numbers">
        {weekDays.map((day) => {
          const outside = !isSameMonth(day, viewDate);
          const weekend = day.getDay() === 0 || day.getDay() === 6;
          const today = isToday(day);
          const selected = isSameDay(day, selectedDate);
          const classes = [
            "day-number",
            outside ? "is-outside" : "",
            weekend ? "is-weekend" : "",
            today ? "is-today" : "",
            selected ? "is-selected" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div
              key={day.toISOString()}
              className={classes}
              onClick={() => onSelectDay(day)}
            >
              <span className="day-number-badge">{day.getDate()}</span>
            </div>
          );
        })}
      </div>

      {/* Multi-day / all-day spanning bars */}
      {layout.laneCount > 0 && (
        <div
          className="week-bars"
          style={{ gridTemplateRows: `repeat(${layout.laneCount}, 18px)` }}
        >
          {layout.bars.map((bar) => {
            const cls = [
              "bar",
              bar.isStart ? "is-start" : "",
              bar.isEnd ? "is-end" : "",
              !bar.isStart ? "is-continued" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <div
                key={bar.event.id + bar.startCol}
                className={cls}
                style={{
                  gridColumn: `${bar.startCol + 1} / span ${bar.span}`,
                  gridRow: bar.lane + 1,
                  ["--bar-accent" as string]: bar.event.color,
                }}
                title={bar.event.title}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenEvent(bar.event);
                }}
              >
                {bar.isStart && <span className="bar-tick" />}
                <span className="bar-label">{bar.isStart ? bar.event.title : ""}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Per-day timed events */}
      <div className="week-singles" ref={singlesRef}>
        {weekDays.map((day, col) => {
          const singles = layout.singlesByCol[col];
          // Show as many as fit; reserve a line for "+N" when overflowing.
          let visible = singles;
          let hidden = 0;
          if (singles.length > budget) {
            visible = singles.slice(0, Math.max(1, budget - 1));
            hidden = singles.length - visible.length;
          }
          const selected = isSameDay(day, selectedDate);
          return (
            <div
              key={day.toISOString()}
              className={"day-singles" + (selected ? " is-selected" : "")}
              onClick={() => onSelectDay(day)}
            >
              {visible.map((ev) => (
                <div
                  key={ev.id}
                  className="chip"
                  style={{ ["--chip-color" as string]: ev.color }}
                  title={ev.title}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenEvent(ev);
                  }}
                >
                  <span className="chip-tick" />
                  <span className="chip-label">{ev.title}</span>
                </div>
              ))}
              {hidden > 0 && (
                <div
                  className="day-more"
                  onClick={(e) => {
                    e.stopPropagation();
                    const r = e.currentTarget.getBoundingClientRect();
                    setPeek({ day, x: r.left, y: r.bottom + 4 });
                  }}
                >
                  +{hidden}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {peek && (
        <DayPeekPopover
          day={peek.day}
          events={peekEvents}
          timeFormat={timeFormat}
          anchor={{ x: peek.x, y: peek.y }}
          onOpenEvent={onOpenEvent}
          onClose={() => setPeek(null)}
        />
      )}
    </div>
  );
}
