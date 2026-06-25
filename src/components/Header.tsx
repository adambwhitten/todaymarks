import { monthName } from "@/lib/date";
import {
  CalendarIcon,
  CameraIcon,
  ChevronLeft,
  ChevronRight,
  RefreshIcon,
  SearchIcon,
  SettingsIcon,
} from "./Icons";

interface HeaderProps {
  viewDate: Date;
  refreshing: boolean;
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
  refreshing,
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
        <h1 className="header-month" data-tauri-drag-region>
          {monthName(viewDate)}
        </h1>
        <span className="header-year" data-tauri-drag-region>
          {viewDate.getFullYear()}
        </span>
      </div>
      <div className="header-actions">
        <button className="icon-btn" onClick={onPrev} title="Previous month">
          <ChevronLeft />
        </button>
        <button className="icon-btn" onClick={onNext} title="Next month">
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
