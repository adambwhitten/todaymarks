import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type {
  AppleAuthStatus,
  CalendarEvent,
  CalendarInfo,
  EventInput,
  Settings,
} from "@/lib/types";
import {
  addMonths,
  monthGrid,
  startOfDay,
  weekdayLabels,
  DAY_MS,
} from "@/lib/date";
import { Header } from "@/components/Header";
import { WeekRow } from "@/components/WeekRow";
import { AgendaPanel } from "@/components/AgendaPanel";
import { SettingsModal } from "@/components/SettingsModal";
import { SearchModal } from "@/components/SearchModal";
import { EventModal } from "@/components/EventModal";
import { CameraModal } from "@/components/CameraModal";
import { CalendarsModal } from "@/components/CalendarsModal";
import { UpdateBanner } from "@/components/UpdateBanner";

const DEFAULT_SETTINGS: Settings = {
  hiddenCalendarIds: [],
  calendarColors: {},
  weekStart: 0,
  timeFormat: "12h",
  defaultCalendarId: null,
  defaultDurationMinutes: 60,
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
    for (let i = 0; i < 6; i++) rows.push(grid.slice(i * 7, i * 7 + 7));
    return rows;
  }, [viewDate, settings.weekStart]);

  const range = useMemo(() => {
    const grid = monthGrid(viewDate, settings.weekStart);
    const start = grid[0].getTime();
    const end = grid[grid.length - 1].getTime() + DAY_MS;
    return { start, end };
  }, [viewDate, settings.weekStart]);

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
        setViewDate((d) => addMonths(d, -1));
      } else if (e.key === "ArrowRight") {
        setViewDate((d) => addMonths(d, 1));
      } else if (e.key.toLowerCase() === "t") {
        const today = startOfDay(new Date());
        setViewDate(today);
        setSelectedDate(today);
      } else if (e.key.toLowerCase() === "n") {
        setModal({ kind: "event", event: null, date: selectedDate.getTime() });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal.kind, selectedDate]);

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
      <div className="titlebar-drag" data-tauri-drag-region />
      <div className="app-body">
        <Header
          viewDate={viewDate}
          refreshing={loading}
          onPrev={() => setViewDate((d) => addMonths(d, -1))}
          onNext={() => setViewDate((d) => addMonths(d, 1))}
          onRefresh={handleRefresh}
          onSearch={() => setModal({ kind: "search" })}
          onCamera={() => setModal({ kind: "camera" })}
          onCalendars={() => setModal({ kind: "calendars" })}
          onSettings={async () => {
            setModal({ kind: "settings" });
            setAppleStatus(await api.appleAuthStatus());
          }}
        />

        <div className="calendar">
          <div className="weekday-row">
            {weekdayLabels(settings.weekStart).map((label, i) => (
              <div key={i} className="weekday-cell">
                {label}
              </div>
            ))}
          </div>

          <div className="weeks" style={{ position: "relative" }}>
            {loading && (
              <div className="loading-veil">
                <div className="spinner" />
              </div>
            )}
            {weeks.map((week, i) => (
              <WeekRow
                key={i}
                weekDays={week}
                viewDate={viewDate}
                selectedDate={selectedDate}
                events={events}
                onSelectDay={setSelectedDate}
                onOpenEvent={(event) =>
                  setModal({ kind: "event", event, date: event.start })
                }
              />
            ))}
          </div>
        </div>

        <AgendaPanel
          selectedDate={selectedDate}
          events={events}
          settings={settings}
          height={agendaHeight}
          onHeightChange={setAgendaHeight}
          onOpenEvent={(event) =>
            setModal({ kind: "event", event, date: event.start })
          }
          onNewEvent={() =>
            setModal({ kind: "event", event: null, date: selectedDate.getTime() })
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
