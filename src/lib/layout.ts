import type { CalendarEvent } from "./types";
import { DAY_MS, startOfDay } from "./date";

const HOUR_MS = 60 * 60 * 1000;

/** A timed event positioned within a single day column of the time grid. */
export interface TimedBlock {
  event: CalendarEvent;
  /** Pixel offset from the top of the day (midnight). */
  top: number;
  /** Pixel height of the block. */
  height: number;
  /** Horizontal position within the column, 0..1. */
  left: number;
  /** Fraction of the column width, 0..1. */
  width: number;
}

/** True for events that belong in the all-day band (all-day or multi-day). */
export function isAllDayBlock(ev: CalendarEvent): boolean {
  return ev.allDay || isBarEvent(ev);
}

/**
 * Lay out one day's timed events into positioned blocks. Overlapping events are
 * packed side by side: events are grouped into overlap clusters and each cluster
 * is split into the minimum number of columns so nothing visually collides.
 */
export function layoutDayColumn(
  events: CalendarEvent[],
  dayStartMs: number,
  hourHeight: number,
  minBlockPx = 18,
): TimedBlock[] {
  const dayEndMs = dayStartMs + DAY_MS;
  const timed = events
    .filter((e) => !isAllDayBlock(e) && e.start < dayEndMs && e.end > dayStartMs)
    .sort((a, b) => a.start - b.start || b.end - a.end);

  // Position each block vertically (clamped to the day) and note its span.
  const items = timed.map((event) => {
    const s = Math.max(event.start, dayStartMs);
    const e = Math.min(event.end, dayEndMs);
    return {
      event,
      spanStart: s,
      spanEnd: e,
      top: ((s - dayStartMs) / HOUR_MS) * hourHeight,
      height: Math.max(((e - s) / HOUR_MS) * hourHeight, minBlockPx),
      col: 0,
      cols: 1,
    };
  });

  // Walk clusters of transitively-overlapping events; assign columns greedily.
  let i = 0;
  while (i < items.length) {
    let clusterEnd = items[i].spanEnd;
    let j = i + 1;
    while (j < items.length && items[j].spanStart < clusterEnd) {
      clusterEnd = Math.max(clusterEnd, items[j].spanEnd);
      j++;
    }
    const cluster = items.slice(i, j);
    const colEnds: number[] = [];
    for (const it of cluster) {
      let placed = false;
      for (let c = 0; c < colEnds.length; c++) {
        if (colEnds[c] <= it.spanStart) {
          it.col = c;
          colEnds[c] = it.spanEnd;
          placed = true;
          break;
        }
      }
      if (!placed) {
        it.col = colEnds.length;
        colEnds.push(it.spanEnd);
      }
    }
    for (const it of cluster) it.cols = colEnds.length;
    i = j;
  }

  return items.map((it) => ({
    event: it.event,
    top: it.top,
    height: it.height,
    left: it.col / it.cols,
    width: 1 / it.cols,
  }));
}

/** A multi-day / all-day event positioned within one week row. */
export interface BarSegment {
  event: CalendarEvent;
  /** 0-based column where the bar starts in this week. */
  startCol: number;
  /** Number of columns the bar spans within this week. */
  span: number;
  /** True if the event truly begins in this week (rounded left edge). */
  isStart: boolean;
  /** True if the event truly ends in this week (rounded right edge). */
  isEnd: boolean;
  /** Lane (row) within the bar band. */
  lane: number;
}

export interface WeekLayout {
  bars: BarSegment[];
  laneCount: number;
  /** Single-day timed events, indexed by column (0-6). */
  singlesByCol: CalendarEvent[][];
}

function intersectsDay(ev: CalendarEvent, dayStart: number): boolean {
  const dayEnd = dayStart + DAY_MS;
  return ev.start < dayEnd && ev.end > dayStart;
}

/**
 * A month-grid bar is only for events that span more than one day; single-day
 * all-day events render as ordinary minimalist chips (same as timed events).
 */
function isBarEvent(ev: CalendarEvent): boolean {
  const s = startOfDay(new Date(ev.start)).getTime();
  const e = startOfDay(new Date(ev.end - 1)).getTime();
  return e > s;
}

export function layoutWeek(weekDays: Date[], events: CalendarEvent[]): WeekLayout {
  const weekStartMs = weekDays[0].getTime();
  const weekEndMs = weekDays[6].getTime() + DAY_MS;

  const singlesByCol: CalendarEvent[][] = [[], [], [], [], [], [], []];
  const barCandidates: { event: CalendarEvent; startCol: number; endCol: number }[] = [];

  for (const ev of events) {
    if (ev.start >= weekEndMs || ev.end <= weekStartMs) continue;

    if (isBarEvent(ev)) {
      let startCol = 0;
      let endCol = 6;
      for (let c = 0; c < 7; c++) {
        if (intersectsDay(ev, weekDays[c].getTime())) {
          startCol = c;
          break;
        }
      }
      for (let c = 6; c >= 0; c--) {
        if (intersectsDay(ev, weekDays[c].getTime())) {
          endCol = c;
          break;
        }
      }
      barCandidates.push({ event: ev, startCol, endCol });
    } else {
      for (let c = 0; c < 7; c++) {
        if (intersectsDay(ev, weekDays[c].getTime())) {
          singlesByCol[c].push(ev);
          break;
        }
      }
    }
  }

  // Greedy lane assignment so overlapping bars stack instead of colliding.
  barCandidates.sort((a, b) => a.startCol - b.startCol || b.endCol - a.endCol);
  const laneEnds: number[] = []; // last occupied column per lane
  const bars: BarSegment[] = [];

  for (const cand of barCandidates) {
    let lane = laneEnds.findIndex((end) => end < cand.startCol);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(cand.endCol);
    } else {
      laneEnds[lane] = cand.endCol;
    }
    const evStartDay = startOfDay(new Date(cand.event.start)).getTime();
    const evEndDay = startOfDay(new Date(cand.event.end - 1)).getTime();
    bars.push({
      event: cand.event,
      startCol: cand.startCol,
      span: cand.endCol - cand.startCol + 1,
      isStart: evStartDay >= weekStartMs,
      isEnd: evEndDay < weekEndMs,
      lane,
    });
  }

  // Sort timed events within each day by start time.
  for (const col of singlesByCol) {
    col.sort((a, b) => a.start - b.start);
  }

  return { bars, laneCount: laneEnds.length, singlesByCol };
}
