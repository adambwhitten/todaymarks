import type { CalendarEvent } from "./types";
import { DAY_MS, startOfDay } from "./date";

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

/** A bar event is anything all-day, or anything spanning more than one day. */
function isBarEvent(ev: CalendarEvent): boolean {
  if (ev.allDay) return true;
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
