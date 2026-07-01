/** Date helpers built on the native Date object (local time). */

export const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(d: Date): Date {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

export function addDays(d: Date, days: number): Date {
  const n = new Date(d);
  n.setDate(n.getDate() + days);
  return n;
}

export function addMonths(d: Date, months: number): Date {
  const n = new Date(d);
  n.setMonth(n.getMonth() + months);
  return n;
}

export function addWeeks(d: Date, weeks: number): Date {
  return addDays(d, weeks * 7);
}

/** Midnight of the week containing `d`, per `weekStart` (0 = Sun, 1 = Mon). */
export function startOfWeek(d: Date, weekStart: number): Date {
  const n = startOfDay(d);
  const offset = (n.getDay() - weekStart + 7) % 7;
  return addDays(n, -offset);
}

/** The 7 days of the week containing `d`. */
export function weekDays(d: Date, weekStart: number): Date[] {
  const start = startOfWeek(d, weekStart);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

/**
 * Build the month grid, starting on `weekStart` (0 = Sunday, 1 = Monday).
 *
 * Only the weeks that actually contain a day of the month are returned (4, 5,
 * or 6 rows) — a trailing week that would be entirely next-month is dropped.
 * The final row can still spill a few greyed-out next-month days to fill it out
 * (e.g. `…31, 1`), but a full extra week of next month never shows.
 */
export function monthGrid(viewDate: Date, weekStart: number): Date[] {
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const offset = (first.getDay() - weekStart + 7) % 7;
  const gridStart = addDays(first, -offset);
  const daysInMonth = new Date(
    viewDate.getFullYear(),
    viewDate.getMonth() + 1,
    0,
  ).getDate();
  // Leading (prev-month) cells + the month's own days, rounded up to whole weeks.
  const weeks = Math.ceil((offset + daysInMonth) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));
}

export function weekdayLabels(weekStart: number): string[] {
  const base = ["S", "M", "T", "W", "T", "F", "S"];
  return Array.from({ length: 7 }, (_, i) => base[(i + weekStart) % 7]);
}

export function weekdayLabelsLong(weekStart: number): string[] {
  const base = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  return Array.from({ length: 7 }, (_, i) => base[(i + weekStart) % 7]);
}

const MONTHS = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

export function monthName(d: Date): string {
  return MONTHS[d.getMonth()];
}

export function formatTime(ms: number, format: "12h" | "24h"): string {
  const d = new Date(ms);
  if (format === "24h") {
    return `${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes()
    ).padStart(2, "0")}`;
  }
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  const mm = m === 0 ? "" : `:${String(m).padStart(2, "0")}`;
  return `${h}${mm} ${ampm}`;
}

/** An hour-of-day label for the time-grid gutter, e.g. "9 AM" / "12 PM" / "13:00". */
export function formatHourLabel(hour: number, format: "12h" | "24h"): string {
  if (format === "24h") return `${String(hour).padStart(2, "0")}:00`;
  const ampm = hour >= 12 ? "PM" : "AM";
  let h = hour % 12;
  if (h === 0) h = 12;
  return `${h} ${ampm}`;
}

/** Compact date range for a week, e.g. "Jul 6 – 12, 2026" or "Jun 29 – Jul 5, 2026". */
export function formatWeekRange(days: Date[]): string {
  const a = days[0];
  const b = days[days.length - 1];
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const left = a.toLocaleDateString(undefined, opts);
  const right =
    a.getMonth() === b.getMonth()
      ? String(b.getDate())
      : b.toLocaleDateString(undefined, opts);
  return `${left} – ${right}, ${b.getFullYear()}`;
}

export function formatDayHeading(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Inclusive day-span an event covers (for multi-day bar rendering). */
export function eventDaySpan(startMs: number, endMs: number): number {
  const s = startOfDay(new Date(startMs)).getTime();
  // All-day / timed events ending exactly at midnight shouldn't bleed into next day.
  const e = startOfDay(new Date(endMs - 1)).getTime();
  return Math.max(0, Math.round((e - s) / DAY_MS)) + 1;
}
