import { useState } from "react";
import { api } from "@/lib/api";
import { PALETTE } from "@/lib/colors";
import type { CalendarInfo, EventSource, Settings } from "@/lib/types";
import { CheckIcon, XIcon } from "./Icons";

interface CalendarsModalProps {
  calendars: CalendarInfo[];
  settings: Settings;
  onClose: () => void;
  onSettingsChanged: (settings: Settings) => void;
  onRefresh: () => void;
}

const GROUPS: { source: EventSource; label: string }[] = [
  { source: "apple", label: "Apple Calendar" },
  { source: "local", label: "Todaymarks" },
];

export function CalendarsModal({
  calendars,
  settings,
  onClose,
  onSettingsChanged,
  onRefresh,
}: CalendarsModalProps) {
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);

  async function toggleCalendar(cal: CalendarInfo) {
    const hidden = new Set(settings.hiddenCalendarIds);
    if (hidden.has(cal.id)) hidden.delete(cal.id);
    else hidden.add(cal.id);
    const saved = await api.saveSettings({
      ...settings,
      hiddenCalendarIds: [...hidden],
    });
    onSettingsChanged(saved);
    onRefresh();
  }

  async function pickColor(id: string, color: string) {
    const saved = await api.setCalendarColor(id, color);
    onSettingsChanged(saved);
    setColorPickerFor(null);
    onRefresh();
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Calendars</div>
          <button className="icon-btn" onClick={onClose}>
            <XIcon />
          </button>
        </div>

        <div className="modal-body">
          <div className="field-hint" style={{ marginTop: -4 }}>
            Choose which calendars to show in Todaymarks. Tap a color to recolor it.
          </div>

          {calendars.length === 0 && (
            <div className="field-hint">No calendars yet.</div>
          )}

          {GROUPS.map((group) => {
            const items = calendars.filter((c) => c.source === group.source);
            if (items.length === 0) return null;
            return (
              <div key={group.source}>
                <div className="cal-group-label">{group.label}</div>
                <div className="cal-rows">
                  {items.map((cal) => {
                    const visible = !settings.hiddenCalendarIds.includes(cal.id);
                    const pickerOpen = colorPickerFor === cal.id;
                    return (
                      <div key={cal.id} className="cal-row-wrap">
                        <div
                          className={"cal-row" + (visible ? "" : " is-hidden")}
                          onClick={() => toggleCalendar(cal)}
                        >
                          <span
                            className={"cal-radio" + (visible ? " is-on" : "")}
                            style={{
                              borderColor: cal.color,
                              background: visible ? cal.color : "transparent",
                            }}
                          >
                            {visible && <CheckIcon size={13} />}
                          </span>
                          <span className="cal-row-name">{cal.name}</span>
                          <button
                            className="cal-swatch"
                            style={{ background: cal.color }}
                            title="Change color"
                            onClick={(e) => {
                              e.stopPropagation();
                              setColorPickerFor(pickerOpen ? null : cal.id);
                            }}
                          />
                        </div>
                        {pickerOpen && (
                          <div
                            className="color-popover"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {PALETTE.map((c) => (
                              <button
                                key={c}
                                className="color-swatch"
                                style={{
                                  background: c,
                                  outline:
                                    cal.color.toLowerCase() === c.toLowerCase()
                                      ? "2px solid var(--text)"
                                      : "2px solid transparent",
                                }}
                                onClick={() => pickColor(cal.id, c)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
