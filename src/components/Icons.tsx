interface IconProps {
  size?: number;
  className?: string;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const SearchIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </svg>
);

export const CalendarIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
    <path d="M3 9h18M8 2.5v4M16 2.5v4" />
  </svg>
);

export const SettingsIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.3 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1H2a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 3.7 8.3a1.7 1.7 0 0 0-.34-1.87l-.06-.06A2 2 0 1 1 6.13 3.5l.06.06a1.7 1.7 0 0 0 1.87.34h.08a1.7 1.7 0 0 0 1-1.56V2a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.08a1.7 1.7 0 0 0 1.56 1H22a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" />
  </svg>
);

export const PlusIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const CheckIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const VideoIcon = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="2" y="6" width="13" height="12" rx="2.5" />
    <path d="m15 10.5 6-3.5v10l-6-3.5" />
  </svg>
);

export const MapPinIcon = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M20 10c0 5-8 12-8 12s-8-7-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="2.6" />
  </svg>
);

export const ChevronLeft = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="m15 18-6-6 6-6" />
  </svg>
);

export const ChevronRight = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export const XIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const ClockIcon = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const RefreshIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v5h-5" />
  </svg>
);

export const CameraIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2L8 4.8a1 1 0 0 1 .83-.45h6.34a1 1 0 0 1 .83.45L17.5 7h2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
    <circle cx="12" cy="13" r="3.2" />
  </svg>
);

export const NoteIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z" />
    <path d="M8 9h8M8 13h8M8 17h5" />
  </svg>
);

export const AlertIcon = ({ size = 13, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M10.3 3.2 1.8 17.5A2 2 0 0 0 3.5 20.5h17a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

export const LinkIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M10 13a5 5 0 0 0 7.07 0l2-2a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
    <path d="M14 11a5 5 0 0 0-7.07 0l-2 2a5 5 0 0 0 7.07 7.07l1.5-1.5" />
  </svg>
);
