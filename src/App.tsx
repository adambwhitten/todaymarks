import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type {
  AppleAuthStatus,
  CalendarEvent,
  CalendarInfo,
  EventInput,
  Settings,
  ViewMode,
} from "@/lib/types";
import {
  addDays,
  addMonths,
  addWeeks,
  formatDayHeading,
  formatWeekRange,
  monthGrid,
  startOfDay,
  weekDays,
  weekdayLabels,
  DAY_MS,
} from "@/lib/date";
import { Header } from "@/components/Header";
import { WeekRow } from "@/components/WeekRow";
import { TimeGrid } from "@/components/TimeGrid";
import { AgendaPanel } from "@/components/AgendaPanel";
import { SettingsModal } from "@/components/SettingsModal";
import { SearchModal } from "@/components/SearchModal";
import { EventModal } from "@/components/EventModal";
import { CameraModal } from "@/components/CameraModal";
import { CalendarsModal } from "@/components/CalendarsModal";
import { UpdateBanner } from "@/components/UpdateBanner";
import { NotificationScheduler } from "@/components/NotificationScheduler";

const DEFAULT_SETTINGS: Settings = {
  hiddenCalendarIds: [],
  calendarColors: {},
  weekStart: 0,
  timeFormat: "12h",
  defaultCalendarId: null,
  defaultDurationMinutes: 60,
  notificationsEnabled: true,
  reminderLeadMinutes: 5,
  menuBarMode: true,
  launchAtLogin: false,
  icsGistId: null,
  icsFeedUrl: null,
  feedEnabled: false,
};

type ModalState =
  | { kind: "none" }
  | { kind: "settings" }
  | { kind: "search" }
  | { kind: "camera" }
  | { kind: "calendars" }
  | { kind: "event"; event: CalendarEvent | null; date: number };

export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [view, setView] = useState<ViewMode>("month");
  const [viewDate, setViewDate] = useState(() => startOfDay(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
  const [appleStatus, setAppleStatus] = useState<AppleAuthStatus>("unknown");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [agendaHeight, setAgendaHeight] = useState(320);

  const weeks = useMemo(() => {
    const grid = monthGrid(viewDate, settings.weekStart);
    const rows: Date[][] = [];
    for (let i = 0; i < grid.length / 7; i++)
      rows.push(grid.slice(i * 7, i * 7 + 7));
    return rows;
  }, [viewDate, settings.weekStart]);

  // The days shown in the time grid: a full week or a single day.
  const gridDays = useMemo(() => {
    if (view === "week") return weekDays(viewDate, settings.weekStart);
    if (view === "day") return [startOfDay(viewDate)];
    return [];
  }, [view, viewDate, settings.weekStart]);

  const range = useMemo(() => {
    if (view === "month") {
      const grid = monthGrid(viewDate, settings.weekStart);
      return {
        start: grid[0].getTime(),
        end: grid[grid.length - 1].getTime() + DAY_MS,
      };
    }
    return {
      start: gridDays[0].getTime(),
      end: gridDays[gridDays.length - 1].getTime() + DAY_MS,
    };
  }, [view, viewDate, settings.weekStart, gridDays]);

  const contextLabel =
    view === "week"
      ? formatWeekRange(gridDays)
      : view === "day"
        ? formatDayHeading(viewDate)
        : undefined;

  // The agenda panel follows the viewed day in Day view, else the selection.
  const agendaDate = view === "day" ? viewDate : selectedDate;

  // Prev/Next move by the current view's unit.
  const step = useCallback(
    (dir: number) => {
      setViewDate((d) =>
        view === "month"
          ? addMonths(d, dir)
          : view === "week"
            ? addWeeks(d, dir)
            : addDays(d, dir),
      );
    },
    [view],
  );

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listEvents(range.start, range.end);
      setEvents(list);
    } catch (e) {
      console.error("Failed to load events", e);
    } finally {
      setLoading(false);
    }
  }, [range.start, range.end]);

  const refreshCalendars = useCallback(async () => {
    try {
      setCalendars(await api.listCalendars());
    } catch (e) {
      console.error("Failed to list calendars", e);
    }
  }, []);

  // Bootstrap: load settings + Apple auth status. We never block the first event
  // load on the permission dialog — if access isn't determined yet, we request it
  // in the background and re-fetch once the user responds.
  const bootstrapStarted = useRef(false);
  useEffect(() => {
    if (bootstrapStarted.current) return;
    bootstrapStarted.current = true;
    (async () => {
      try {
        const s = await api.getSettings();
        setSettings(s);
        const status = await api.appleAuthStatus();
        setAppleStatus(status);

        // Fire the permission request in the background (don't await it here).
        if (status === "notDetermined") {
          void api
            .requestAppleAccess()
            .catch(() => false)
            .then(async (granted) => {
              // macOS sometimes leaves authorizationStatus lagging at
              // notDetermined right after a grant, so trust the boolean result.
              setAppleStatus(granted ? "authorized" : await api.appleAuthStatus());
              await fetchEvents();
              await refreshCalendars();
            });
        }
      } catch (e) {
        console.error("Bootstrap failed", e);
      } finally {
        setBootstrapped(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load events whenever the visible range changes (after bootstrap).
  useEffect(() => {
    if (!bootstrapped) return;
    void fetchEvents();
    void refreshCalendars();
  }, [bootstrapped, fetchEvents, refreshCalendars]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modal.kind !== "none") {
        if (e.key === "Escape") setModal({ kind: "none" });
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setModal({ kind: "search" });
      } else if (e.key === "ArrowLeft") {
        step(-1);
      } else if (e.key === "ArrowRight") {
        step(1);
      } else if (e.key.toLowerCase() === "t") {
        const today = startOfDay(new Date());
        setViewDate(today);
        setSelectedDate(today);
      } else if (e.key.toLowerCase() === "n") {
        const day = view === "day" ? viewDate : selectedDate;
        setModal({ kind: "event", event: null, date: day.getTime() });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal.kind, selectedDate, step, view, viewDate]);

  const handleSaveEvent = useCallback(
    async (input: EventInput, calendarId: string) => {
      if (input.id && input.id.startsWith("apple:")) {
        // Editing an existing Apple event.
        await api.updateAppleEvent(input.id, input);
      } else if (calendarId.startsWith("apple:")) {
        // New event on an Apple calendar (written via EventKit).
        await api.createAppleEvent(calendarId, input);
      } else {
        // Local event (SQLite).
        await api.saveEvent(input);
      }
      await fetchEvents();
    },
    [fetchEvents]
  );

  const handleDeleteEvent = useCallback(
    async (id: string) => {
      await api.deleteEvent(id);
      await fetchEvents();
    },
    [fetchEvents]
  );

  const handleJoin = useCallback((event: CalendarEvent) => {
    if (event.url) void api.openExternal(event.url);
  }, []);

  const requestApple = useCallback(async () => {
    const granted = await api.requestAppleAccess().catch(() => false);
    setAppleStatus(granted ? "authorized" : await api.appleAuthStatus());
    await fetchEvents();
    await refreshCalendars();
  }, [fetchEvents, refreshCalendars]);


  const handleRefresh = useCallback(async () => {
    await Promise.all([fetchEvents(), refreshCalendars()]);
  }, [fetchEvents, refreshCalendars]);

  return (
    <div className="app">
      <UpdateBanner />
      <NotificationScheduler
        enabled={settings.notificationsEnabled}
        leadMinutes={settings.reminderLeadMinutes}
        timeFormat={settings.timeFormat}
      />
      <div className="titlebar-drag" data-tauri-drag-region />
      <div className="app-body">
        <Header
          viewDate={viewDate}
          view={view}
          contextLabel={contextLabel}
          refreshing={loading}
          onViewChange={setView}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onRefresh={handleRefresh}
          onSearch={() => setModal({ kind: "search" })}
          onCamera={() => setModal({ kind: "camera" })}
          onCalendars={() => setModal({ kind: "calendars" })}
          onSettings={async () => {
            setModal({ kind: "settings" });
            setAppleStatus(await api.appleAuthStatus());
          }}
        />

        <div className="calendar" style={{ position: "relative" }}>
          {loading && (
            <div className="loading-veil">
              <div className="spinner" />
            </div>
          )}

          {view === "month" ? (
            <>
              <div className="weekday-row">
                {weekdayLabels(settings.weekStart).map((label, i) => (
                  <div key={i} className="weekday-cell">
                    {label}
                  </div>
                ))}
              </div>

              <div className="weeks">
                {weeks.map((week, i) => (
                  <WeekRow
                    key={i}
                    weekDays={week}
                    viewDate={viewDate}
                    selectedDate={selectedDate}
                    events={events}
                    timeFormat={settings.timeFormat}
                    onSelectDay={setSelectedDate}
                    onOpenEvent={(event) =>
                      setModal({ kind: "event", event, date: event.start })
                    }
                  />
                ))}
              </div>
            </>
          ) : (
            <TimeGrid
              days={gridDays}
              events={events}
              settings={settings}
              showDayHeaders={view === "week"}
              onOpenEvent={(event) =>
                setModal({ kind: "event", event, date: event.start })
              }
              onCreate={(day) => {
                setSelectedDate(startOfDay(day));
                setModal({
                  kind: "event",
                  event: null,
                  date: startOfDay(day).getTime(),
                });
              }}
              onOpenDay={(day) => {
                setViewDate(startOfDay(day));
                setView("day");
              }}
            />
          )}
        </div>

        <AgendaPanel
          selectedDate={agendaDate}
          events={events}
          settings={settings}
          height={agendaHeight}
          onHeightChange={setAgendaHeight}
          onOpenEvent={(event) =>
            setModal({ kind: "event", event, date: event.start })
          }
          onNewEvent={() =>
            setModal({
              kind: "event",
              event: null,
              date: agendaDate.getTime(),
            })
          }
          onJoin={handleJoin}
        />
      </div>

      {modal.kind === "settings" && (
        <SettingsModal
          settings={settings}
          calendars={calendars}
          appleStatus={appleStatus}
          appVersion={__APP_VERSION__}
          onClose={() => setModal({ kind: "none" })}
          onSettingsChanged={setSettings}
          onRequestApple={requestApple}
        />
      )}

      {modal.kind === "camera" && (
        <CameraModal onClose={() => setModal({ kind: "none" })} />
      )}

      {modal.kind === "calendars" && (
        <CalendarsModal
          calendars={calendars}
          settings={settings}
          onClose={() => setModal({ kind: "none" })}
          onSettingsChanged={setSettings}
          onRefresh={handleRefresh}
        />
      )}

      {modal.kind === "search" && (
        <SearchModal
          events={events}
          onClose={() => setModal({ kind: "none" })}
          onPick={(event) => {
            setSelectedDate(startOfDay(new Date(event.start)));
            setViewDate(startOfDay(new Date(event.start)));
            setModal({ kind: "event", event, date: event.start });
          }}
        />
      )}

      {modal.kind === "event" && (
        <EventModal
          event={modal.event}
          defaultDate={startOfDay(new Date(modal.date)).getTime()}
          timeFormat={settings.timeFormat}
          calendars={calendars}
          defaultCalendarId={settings.defaultCalendarId}
          defaultDurationMinutes={settings.defaultDurationMinutes}
          onClose={() => setModal({ kind: "none" })}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
          onJoin={(url) => void api.openExternal(url)}
        />
      )}
    </div>
  );
}
