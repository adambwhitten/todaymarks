import { useMemo, useState } from "react";
import type { CalendarEvent } from "@/lib/types";
import { XIcon } from "./Icons";

interface SearchModalProps {
  events: CalendarEvent[];
  onClose: () => void;
  onPick: (event: CalendarEvent) => void;
}

export function SearchModal({ events, onClose, onPick }: SearchModalProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as CalendarEvent[];
    return events
      .filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.notes ?? "").toLowerCase().includes(q) ||
          (e.location ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) => a.start - b.start)
      .slice(0, 40);
  }, [query, events]);

  return (
    <div className="overlay" onClick={onClose} style={{ alignItems: "flex-start", paddingTop: 90 }}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <input
            className="input"
            placeholder="Search events…"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
            style={{ fontSize: 16, padding: "11px 14px", flex: 1, minWidth: 0 }}
          />
          <button className="icon-btn" onClick={onClose}>
            <XIcon />
          </button>
        </div>
        <div className="modal-body" style={{ paddingTop: 8 }}>
          {query.trim() === "" && (
            <div className="field-hint">Type to search across all your events.</div>
          )}
          {query.trim() !== "" && results.length === 0 && (
            <div className="field-hint">No matching events.</div>
          )}
          <div className="search-list">
            {results.map((ev) => (
              <div
                key={ev.id}
                className="search-item"
                onClick={() => onPick(ev)}
              >
                <span className="cal-dot" style={{ background: ev.color }} />
                <span className="search-date">
                  {new Date(ev.start).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="search-title">{ev.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
