import { useState } from "react";
import { api } from "@/lib/api";
import type { AppleAuthStatus, CalendarInfo, Settings } from "@/lib/types";
import { CheckIcon, XIcon } from "./Icons";

interface SettingsModalProps {
  settings: Settings;
  calendars: CalendarInfo[];
  appleStatus: AppleAuthStatus;
  appVersion: string;
  onClose: () => void;
  onSettingsChanged: (settings: Settings) => void;
  onRequestApple: () => Promise<void>;
}

export function SettingsModal({
  settings,
  calendars,
  appleStatus,
  appVersion,
  onClose,
  onSettingsChanged,
  onRequestApple,
}: SettingsModalProps) {
  const [requesting, setRequesting] = useState(false);

  async function requestApple() {
    setRequesting(true);
    try {
      await onRequestApple();
    } finally {
      setRequesting(false);
    }
  }

  async function setTimeFormat(fmt: "12h" | "24h") {
    const saved = await api.saveSettings({ ...settings, timeFormat: fmt });
    onSettingsChanged(saved);
  }

  async function setWeekStart(start: number) {
    const saved = await api.saveSettings({ ...settings, weekStart: start });
    onSettingsChanged(saved);
  }

  async function patch(partial: Partial<Settings>) {
    const saved = await api.saveSettings({ ...settings, ...partial });
    onSettingsChanged(saved);
  }

  const writableCalendars = calendars.filter((c) => c.editable);
  const appleConnected = appleStatus === "authorized";

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal is-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Settings</div>
          <button className="icon-btn" onClick={onClose}>
            <XIcon />
          </button>
        </div>

        <div className="modal-body">
          {/* Apple Calendar */}
          <div className="section-label">Apple Calendar</div>
          {appleConnected ? (
            <div className="banner">
              <span className="status-ok" style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <CheckIcon /> Connected to Apple Calendar
              </span>
              <button
                className="btn"
                onClick={() => api.openCalendarPrivacySettings()}
              >
                Manage Access
              </button>
            </div>
          ) : appleStatus === "unsupported" ? (
            <div className="status-line status-muted">
              Apple Calendar is only available on macOS.
            </div>
          ) : (
            <div className="banner">
              <span>
                {appleStatus === "denied" || appleStatus === "restricted"
                  ? "Access was denied. Enable Todaymarks under Privacy → Calendars, then click Re-check."
                  : "Grant access to show your Apple Calendar events."}
              </span>
              {appleStatus === "denied" || appleStatus === "restricted" ? (
                <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                  <button
                    className="btn"
                    onClick={() => api.openCalendarPrivacySettings()}
                  >
                    Open System Settings
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={requestApple}
                    disabled={requesting}
                  >
                    {requesting ? "Checking…" : "Re-check"}
                  </button>
                </div>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={requestApple}
                  disabled={requesting}
                >
                  {requesting ? "Requesting…" : "Connect"}
                </button>
              )}
            </div>
          )}

          {/* New Events */}
          <div className="section-label" style={{ marginTop: 8 }}>
            New Events
          </div>
          <div className="efield-group">
            <div className="efield">
              <span className="efield-label">Default calendar</span>
              <select
                className="efield-select is-right"
                value={settings.defaultCalendarId ?? ""}
                onChange={(e) =>
                  patch({ defaultCalendarId: e.target.value || null })
                }
              >
                {writableCalendars.length === 0 && (
                  <option value="">No writable calendars</option>
                )}
                {writableCalendars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="efield">
              <span className="efield-label">Default duration</span>
              <select
                className="efield-select is-right"
                value={settings.defaultDurationMinutes}
                onChange={(e) =>
                  patch({ defaultDurationMinutes: Number(e.target.value) })
                }
              >
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </div>
          </div>

          {/* Preferences */}
          <div className="section-label" style={{ marginTop: 8 }}>
            Preferences
          </div>
          <div className="efield-group">
            <div
              className="efield is-toggle"
              onClick={() =>
                setTimeFormat(settings.timeFormat === "24h" ? "12h" : "24h")
              }
            >
              <span className="efield-label">24-Hour Time</span>
              <span
                className={"switch" + (settings.timeFormat === "24h" ? " is-on" : "")}
              >
                <span className="switch-knob" />
              </span>
            </div>
            <div className="efield">
              <span className="efield-label">Week starts on</span>
              <select
                className="efield-select is-right"
                value={settings.weekStart}
                onChange={(e) => setWeekStart(Number(e.target.value))}
              >
                <option value={0}>Sunday</option>
                <option value={1}>Monday</option>
              </select>
            </div>
          </div>

          <div className="app-credit">
            Todaymarks v{appVersion} · © {new Date().getFullYear()}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
