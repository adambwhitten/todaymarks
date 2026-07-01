import { monthName } from "@/lib/date";
import type { ViewMode } from "@/lib/types";
import {
  CalendarIcon,
  CameraIcon,
  ChevronLeft,
  ChevronRight,
  RefreshIcon,
  SearchIcon,
  SettingsIcon,
} from "./Icons";

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

interface HeaderProps {
  viewDate: Date;
  view: ViewMode;
  /** Small line under the title for day/week context (e.g. a date or range). */
  contextLabel?: string;
  refreshing: boolean;
  onViewChange: (view: ViewMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onRefresh: () => void;
  onSearch: () => void;
  onCamera: () => void;
  onCalendars: () => void;
  onSettings: () => void;
}

export function Header({
  viewDate,
  view,
  contextLabel,
  refreshing,
  onViewChange,
  onPrev,
  onNext,
  onRefresh,
  onSearch,
  onCamera,
  onCalendars,
  onSettings,
}: HeaderProps) {
  return (
    <header className="header" data-tauri-drag-region>
      <div className="header-title" data-tauri-drag-region>
        <div className="header-title-main" data-tauri-drag-region>
          <h1 className="header-month" data-tauri-drag-region>
            {monthName(viewDate)}
          </h1>
          <span className="header-year" data-tauri-drag-region>
            {viewDate.getFullYear()}
          </span>
          <div className="view-switch">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                className={"view-switch-btn" + (view === v.id ? " is-active" : "")}
                onClick={() => onViewChange(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
        {contextLabel && <div className="header-context">{contextLabel}</div>}
      </div>
      <div className="header-actions">
        <button className="icon-btn" onClick={onPrev} title="Previous">
          <ChevronLeft />
        </button>
        <button className="icon-btn" onClick={onNext} title="Next">
          <ChevronRight />
        </button>
        <button
          className="icon-btn"
          onClick={onRefresh}
          title="Refresh"
          disabled={refreshing}
        >
          <RefreshIcon className={refreshing ? "spin" : undefined} />
        </button>
        <button className="icon-btn" onClick={onSearch} title="Search">
          <SearchIcon />
        </button>
        <button className="icon-btn" onClick={onCamera} title="How do I look?">
          <CameraIcon />
        </button>
        <button className="icon-btn" onClick={onCalendars} title="Calendars">
          <CalendarIcon />
        </button>
        <button className="icon-btn" onClick={onSettings} title="Settings">
          <SettingsIcon />
        </button>
      </div>
    </header>
  );
}
