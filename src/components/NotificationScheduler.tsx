import { useEffect, useRef } from "react";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { api } from "@/lib/api";
import type { CalendarEvent } from "@/lib/types";
import { formatTime } from "@/lib/date";

const SNOOZE_KEY = "todaymarks.conflictSnoozes";
const HOUR = 60 * 60 * 1000;

function loadSnoozes(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SNOOZE_KEY) || "{}");
  } catch {
    return {};
  }
}

interface Props {
  enabled: boolean;
  leadMinutes: number;
  timeFormat: "12h" | "24h";
}

/**
 * Runs while the app is open. Fires native notifications for upcoming meetings
 * (leadMinutes before they start) and for conflicts whose "remind me later"
 * time has arrived. Renders nothing.
 */
export function NotificationScheduler({ enabled, leadMinutes, timeFormat }: Props) {
  const eventsRef = useRef<CalendarEvent[]>([]);
  const firedRef = useRef<Set<string>>(new Set());
  const permittedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function refresh() {
      const now = Date.now();
      try {
        eventsRef.current = await api.listEvents(now - HOUR, now + 26 * HOUR);
      } catch {
        /* ignore */
      }
    }

    (async () => {
      let granted = await isPermissionGranted();
      if (!granted) granted = (await requestPermission()) === "granted";
      permittedRef.current = granted;
      await refresh();
    })();

    function check() {
      if (cancelled || !permittedRef.current) return;
      const now = Date.now();

      // Upcoming meeting reminders.
      for (const ev of eventsRef.current) {
        if (ev.allDay) continue;
        const remindAt = ev.start - leadMinutes * 60 * 1000;
        const key = `meeting:${ev.id}`;
        if (now >= remindAt && now < ev.start + 60 * 1000 && !firedRef.current.has(key)) {
          firedRef.current.add(key);
          const when =
            leadMinutes <= 0
              ? "Starting now"
              : `Starts in ${leadMinutes} min · ${formatTime(ev.start, timeFormat)}`;
          const detail = ev.meetingProvider || ev.location || when;
          sendNotification({
            title: ev.title,
            body: leadMinutes > 0 ? `${when}${ev.meetingProvider ? ` · ${ev.meetingProvider}` : ""}` : detail,
          });
        }
      }

      // Conflict "remind me later" reminders.
      const snoozes = loadSnoozes();
      const byId = new Map(eventsRef.current.map((e) => [e.id, e]));
      for (const [id, until] of Object.entries(snoozes)) {
        const key = `conflict:${id}:${until}`;
        if (now >= until && now < until + 5 * 60 * 1000 && !firedRef.current.has(key)) {
          firedRef.current.add(key);
          const ev = byId.get(id);
          sendNotification({
            title: "Possible scheduling conflict",
            body: ev
              ? `"${ev.title}" overlaps another event.`
              : "You have overlapping events.",
          });
        }
      }
    }

    check();
    const checkTimer = setInterval(check, 30 * 1000);
    const refreshTimer = setInterval(refresh, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(checkTimer);
      clearInterval(refreshTimer);
    };
  }, [enabled, leadMinutes, timeFormat]);

  return null;
}
