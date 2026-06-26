import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type {
  AppleAuthStatus,
  CalendarEvent,
  CalendarInfo,
  EventInput,
  Settings,
} from "./types";

export const api = {
  getSettings: () => invoke<Settings>("get_settings"),
  saveSettings: (settings: Settings) =>
    invoke<Settings>("save_settings", { settings }),
  setCalendarColor: (calendarId: string, color: string | null) =>
    invoke<Settings>("set_calendar_color", { calendarId, color }),
  setLaunchAtLogin: (enabled: boolean) =>
    invoke<Settings>("set_launch_at_login", { enabled }),
  publishIcsFeed: () => invoke<Settings>("publish_ics_feed"),
  deleteIcsFeed: () => invoke<Settings>("delete_ics_feed"),

  appleAuthStatus: () => invoke<AppleAuthStatus>("apple_authorization_status"),
  requestAppleAccess: () => invoke<boolean>("request_apple_access"),
  openCalendarPrivacySettings: () =>
    invoke<void>("open_calendar_privacy_settings"),

  listCalendars: () => invoke<CalendarInfo[]>("list_calendars"),
  listEvents: (start: number, end: number) =>
    invoke<CalendarEvent[]>("list_events", { start, end }),

  saveEvent: (input: EventInput) => invoke<CalendarEvent>("save_event", { input }),
  createAppleEvent: (calendarId: string, input: EventInput) =>
    invoke<void>("create_apple_event", { calendarId, input }),
  updateAppleEvent: (id: string, input: EventInput) =>
    invoke<void>("update_apple_event", { id, input }),
  deleteEvent: (id: string) => invoke<void>("delete_event", { id }),

  openExternal: (url: string) => openUrl(url),
};
