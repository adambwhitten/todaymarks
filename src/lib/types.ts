export type EventSource = "apple" | "local";

/** Which calendar layout is shown. */
export type ViewMode = "month" | "week" | "day";

export interface CalendarEvent {
  id: string;
  source: EventSource;
  calendarId: string | null;
  calendarName: string | null;
  title: string;
  notes: string | null;
  location: string | null;
  /** Unix epoch milliseconds. */
  start: number;
  /** Unix epoch milliseconds. */
  end: number;
  allDay: boolean;
  color: string;
  url: string | null;
  meetingProvider: string | null;
  editable: boolean;
}

export interface CalendarInfo {
  id: string;
  name: string;
  color: string;
  source: EventSource;
  editable: boolean;
}

export interface EventInput {
  id?: string | null;
  title: string;
  notes?: string | null;
  location?: string | null;
  start: number;
  end: number;
  allDay: boolean;
  color?: string | null;
  url?: string | null;
}

export interface Settings {
  hiddenCalendarIds: string[];
  calendarColors: Record<string, string>;
  weekStart: number;
  timeFormat: "12h" | "24h";
  defaultCalendarId: string | null;
  defaultDurationMinutes: number;
  notificationsEnabled: boolean;
  reminderLeadMinutes: number;
  menuBarMode: boolean;
  launchAtLogin: boolean;
  icsGistId: string | null;
  icsFeedUrl: string | null;
  feedEnabled: boolean;
}

export type AppleAuthStatus =
  | "notDetermined"
  | "authorized"
  | "denied"
  | "restricted"
  | "writeOnly"
  | "unknown"
  | "unsupported";
