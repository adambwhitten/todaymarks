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
 * Build the 6-week grid (42 cells) that contains the given month, starting on
 * `weekStart` (0 = Sunday, 1 = Monday).
 */
export function monthGrid(viewDate: Date, weekStart: number): Date[] {
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const offset = (first.getDay() - weekStart + 7) % 7;
  const gridStart = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
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
