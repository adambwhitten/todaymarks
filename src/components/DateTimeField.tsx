import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { addMonths, formatTime, isSameDay, monthGrid, weekdayLabels } from "@/lib/date";
import { ChevronLeft, ChevronRight, ClockIcon } from "./Icons";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function fmtDateInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function dateLabel(s: string): string {
  return parseDate(s).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
function timeLabel(hhmm: string, fmt: "12h" | "24h"): string {
  const [h, m] = hhmm.split(":").map(Number);
  return formatTime(new Date(2000, 0, 1, h, m).getTime(), fmt);
}

interface Props {
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  timeFormat: "12h" | "24h";
  onDate: (s: string) => void;
  onStart: (s: string) => void;
  onEnd: (s: string) => void;
}

type OpenKind = null | "date" | "start" | "end";

export function DateTimeField({
  date,
  startTime,
  endTime,
  allDay,
  timeFormat,
  onDate,
  onStart,
  onEnd,
}: Props) {
  const [open, setOpen] = useState<OpenKind>(null);
  const dateRef = useRef<HTMLButtonElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const endRef = useRef<HTMLButtonElement>(null);

  const toggle = (k: Exclude<OpenKind, null>) =>
    setOpen((cur) => (cur === k ? null : k));

  return (
    <div className="efield">
      <ClockIcon size={17} className="efield-icon" />
      <div className="dt-row">
        <button ref={dateRef} className="dt-chip" onClick={() => toggle("date")}>
          {dateLabel(date)}
        </button>
        {!allDay && (
          <>
            <button ref={startRef} className="dt-chip" onClick={() => toggle("start")}>
              {timeLabel(startTime, timeFormat)}
            </button>
            <span className="dt-dash">–</span>
            <button ref={endRef} className="dt-chip" onClick={() => toggle("end")}>
              {timeLabel(endTime, timeFormat)}
            </button>
          </>
        )}
      </div>

      {open === "date" && (
        <Popover anchor={dateRef} width={244} onClose={() => setOpen(null)}>
          <MiniCalendar
            value={parseDate(date)}
            onPick={(d) => {
              onDate(fmtDateInput(d));
              setOpen(null);
            }}
          />
        </Popover>
      )}
      {open === "start" && (
        <Popover anchor={startRef} width={150} onClose={() => setOpen(null)}>
          <TimeMenu
            value={startTime}
            fmt={timeFormat}
            onPick={(t) => {
              onStart(t);
              setOpen(null);
            }}
          />
        </Popover>
      )}
      {open === "end" && (
        <Popover anchor={endRef} width={150} onClose={() => setOpen(null)}>
          <TimeMenu
            value={endTime}
            fmt={timeFormat}
            onPick={(t) => {
              onEnd(t);
              setOpen(null);
            }}
          />
        </Popover>
      )}
    </div>
  );
}

function Popover({
  anchor,
  width,
  onClose,
  children,
}: {
  anchor: RefObject<HTMLElement | null>;
  width: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });

  useLayoutEffect(() => {
    const a = anchor.current;
    if (!a) return;
    const r = a.getBoundingClientRect();
    const maxH = 300;
    const top =
      r.bottom + 6 + maxH > window.innerHeight - 12
        ? Math.max(12, r.top - maxH - 6)
        : r.bottom + 6;
    const left = Math.min(r.left, window.innerWidth - width - 12);
    setStyle({ top, left, width, visibility: "visible" });
  }, [anchor, width]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !anchor.current?.contains(t)) onClose();
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc, true);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div ref={ref} className="dt-popover" style={style} onClick={(e) => e.stopPropagation()}>
      {children}
    </div>,
    document.body
  );
}

function MiniCalendar({
  value,
  onPick,
}: {
  value: Date;
  onPick: (d: Date) => void;
}) {
  const [view, setView] = useState(value);
  const grid = monthGrid(view, 0);
  const today = new Date();

  return (
    <div className="mini-cal">
      <div className="mini-cal-head">
        <button className="icon-btn sm" onClick={() => setView(addMonths(view, -1))}>
          <ChevronLeft size={15} />
        </button>
        <span className="mini-cal-title">
          {view.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </span>
        <button className="icon-btn sm" onClick={() => setView(addMonths(view, 1))}>
          <ChevronRight size={15} />
        </button>
      </div>
      <div className="mini-cal-grid">
        {weekdayLabels(0).map((l, i) => (
          <span key={i} className="mini-cal-wd">
            {l}
          </span>
        ))}
        {grid.map((d) => {
          const out = d.getMonth() !== view.getMonth();
          const sel = isSameDay(d, value);
          const isToday = isSameDay(d, today);
          return (
            <button
              key={d.toISOString()}
              className={
                "mini-cal-day" +
                (out ? " out" : "") +
                (sel ? " sel" : "") +
                (isToday && !sel ? " today" : "")
              }
              onClick={() => onPick(d)}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TimeMenu({
  value,
  fmt,
  onPick,
}: {
  value: string;
  fmt: "12h" | "24h";
  onPick: (t: string) => void;
}) {
  const items: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) items.push(`${pad(h)}:${pad(m)}`);
  }
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = listRef.current?.querySelector(".sel") as HTMLElement | null;
    el?.scrollIntoView({ block: "center" });
  }, []);

  return (
    <div className="time-menu" ref={listRef}>
      {items.map((t) => (
        <button
          key={t}
          className={"time-item" + (t === value ? " sel" : "")}
          onClick={() => onPick(t)}
        >
          {timeLabel(t, fmt)}
        </button>
      ))}
    </div>
  );
}
