import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { parseChangelog } from "@/lib/changelog";
import type { AppleAuthStatus, CalendarInfo, Settings } from "@/lib/types";
import { CheckIcon, ChevronLeft, ChevronRight, XIcon } from "./Icons";

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
  const [showWhatsNew, setShowWhatsNew] = useState(false);

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

  async function setLaunchAtLogin(enabled: boolean) {
    const saved = await api.setLaunchAtLogin(enabled);
    onSettingsChanged(saved);
  }

  const [feedBusy, setFeedBusy] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function publishFeed() {
    setFeedBusy(true);
    setFeedError(null);
    try {
      onSettingsChanged(await api.publishIcsFeed());
    } catch (e) {
      setFeedError(String(e));
    } finally {
      setFeedBusy(false);
    }
  }

  async function stopFeed() {
    setFeedBusy(true);
    try {
      onSettingsChanged(await api.deleteIcsFeed());
    } finally {
      setFeedBusy(false);
    }
  }

  async function copyFeed() {
    if (!settings.icsFeedUrl) return;
    try {
      await navigator.clipboard.writeText(settings.icsFeedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  const writableCalendars = calendars.filter((c) => c.editable);
  const appleConnected = appleStatus === "authorized";
  const changelog = useMemo(() => parseChangelog(), []);

  if (showWhatsNew) {
    return (
      <div className="overlay" onClick={onClose}>
        <div className="modal is-wide" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <button
              className="icon-btn"
              onClick={() => setShowWhatsNew(false)}
              title="Back"
            >
              <ChevronLeft />
            </button>
            <div className="modal-title" style={{ flex: 1, marginLeft: 4 }}>
              What's New
            </div>
            <button className="icon-btn" onClick={onClose}>
              <XIcon />
            </button>
          </div>
          <div className="modal-body">
            <div className="changelog">
              {changelog.map((entry, i) => (
                <div className="changelog-entry" key={i}>
                  <div className="changelog-version">{entry.title}</div>
                  <div className="changelog-body">{entry.body}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setShowWhatsNew(false)}>
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

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

          {/* Notifications */}
          <div className="section-label" style={{ marginTop: 8 }}>
            Notifications
          </div>
          <div className="efield-group">
            <div
              className="efield is-toggle"
              onClick={() =>
                patch({ notificationsEnabled: !settings.notificationsEnabled })
              }
            >
              <span className="efield-label">Notify me about meetings & conflicts</span>
              <span
                className={"switch" + (settings.notificationsEnabled ? " is-on" : "")}
              >
                <span className="switch-knob" />
              </span>
            </div>
            {settings.notificationsEnabled && (
              <div className="efield">
                <span className="efield-label">Remind me before a meeting</span>
                <select
                  className="efield-select is-right"
                  value={settings.reminderLeadMinutes}
                  onChange={(e) =>
                    patch({ reminderLeadMinutes: Number(e.target.value) })
                  }
                >
                  <option value={0}>At start time</option>
                  <option value={5}>5 min before</option>
                  <option value={10}>10 min before</option>
                  <option value={15}>15 min before</option>
                  <option value={30}>30 min before</option>
                </select>
              </div>
            )}
          </div>
          <div className="field-hint" style={{ marginTop: 6 }}>
            Notifications fire while Todaymarks is running (including in the menu bar).
          </div>

          {/* Menu bar */}
          <div className="section-label" style={{ marginTop: 8 }}>
            Menu Bar
          </div>
          <div className="efield-group">
            <div
              className="efield is-toggle"
              onClick={() => patch({ menuBarMode: !settings.menuBarMode })}
            >
              <span className="efield-label">Keep running in the menu bar</span>
              <span className={"switch" + (settings.menuBarMode ? " is-on" : "")}>
                <span className="switch-knob" />
              </span>
            </div>
            <div
              className="efield is-toggle"
              onClick={() => setLaunchAtLogin(!settings.launchAtLogin)}
            >
              <span className="efield-label">Launch at login</span>
              <span className={"switch" + (settings.launchAtLogin ? " is-on" : "")}>
                <span className="switch-knob" />
              </span>
            </div>
          </div>

          {/* Calendar Feed (hidden behind a setting — not shipped yet) */}
          {settings.feedEnabled && (
          <>
          <div className="section-label" style={{ marginTop: 8 }}>
            Calendar Feed
          </div>
          <div className="field-hint" style={{ marginTop: -4 }}>
            Publish your local <strong>Todaymarks</strong> calendar as a private link you
            can subscribe to in Cal.com, Google Calendar, etc. It's an unlisted secret
            Gist — anyone with the link can read it, so keep personal events off it.
          </div>
          {settings.icsFeedUrl ? (
            <>
              <div className="efield-group">
                <div className="efield">
                  <input
                    className="efield-input"
                    readOnly
                    value={settings.icsFeedUrl}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button className="efield-open" onClick={copyFeed}>
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button className="btn" onClick={publishFeed} disabled={feedBusy}>
                  {feedBusy ? "Updating…" : "Update feed"}
                </button>
                <button className="btn btn-danger" onClick={stopFeed} disabled={feedBusy}>
                  Stop sharing
                </button>
              </div>
            </>
          ) : (
            <button
              className="btn btn-primary"
              onClick={publishFeed}
              disabled={feedBusy}
              style={{ marginTop: 4 }}
            >
              {feedBusy ? "Publishing…" : "Publish to a secret Gist"}
            </button>
          )}
          {feedError && (
            <div className="status-line status-err" style={{ marginTop: 8 }}>
              {feedError}
            </div>
          )}
          </>
          )}

          {/* About */}
          <div className="section-label" style={{ marginTop: 8 }}>
            About
          </div>
          <div className="efield-group">
            <div className="efield is-toggle" onClick={() => setShowWhatsNew(true)}>
              <span className="efield-label">What's New</span>
              <ChevronRight size={16} className="efield-chevron" />
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
