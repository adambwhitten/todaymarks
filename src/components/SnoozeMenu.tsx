import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

function nextSixPM(): number {
  const d = new Date();
  d.setHours(18, 0, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d.getTime();
}

interface SnoozeMenuProps {
  anchor: RefObject<HTMLElement | null>;
  eventStart: number;
  onSnooze: (untilMs: number, label: string) => void;
  onClose: () => void;
}

export function SnoozeMenu({ anchor, eventStart, onSnooze, onClose }: SnoozeMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });

  useLayoutEffect(() => {
    const a = anchor.current;
    if (!a) return;
    const r = a.getBoundingClientRect();
    const width = 220;
    const left = Math.min(r.left, window.innerWidth - width - 12);
    const top =
      r.bottom + 8 + 160 > window.innerHeight - 12 ? r.top - 160 - 8 : r.bottom + 8;
    setStyle({ top, left, width, visibility: "visible" });
  }, [anchor]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !anchor.current?.contains(t)) onClose();
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [anchor, onClose]);

  const options = [
    { label: "In 1 hour", until: Date.now() + 60 * 60 * 1000 },
    { label: "Tonight", until: nextSixPM() },
    { label: "1 hour before it starts", until: eventStart - 60 * 60 * 1000 },
  ];

  return createPortal(
    <div
      ref={ref}
      className="snooze-menu"
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="snooze-menu-label">Remind me…</div>
      {options.map((o) => (
        <button
          key={o.label}
          className="snooze-item"
          onClick={() => onSnooze(o.until, o.label)}
        >
          {o.label}
        </button>
      ))}
    </div>,
    document.body
  );
}
