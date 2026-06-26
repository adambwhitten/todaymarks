import { useEffect, useRef } from "react";
import { XIcon } from "./Icons";

interface UndoToastProps {
  message: string;
  durationMs?: number;
  onUndo: () => void;
  onClose: () => void;
}

/**
 * A small toast (same look as the update card) with an Undo button and a
 * countdown bar. After the countdown it auto-dismisses and the action sticks.
 */
export function UndoToast({
  message,
  durationMs = 10000,
  onUndo,
  onClose,
}: UndoToastProps) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const t = setTimeout(() => closeRef.current(), durationMs);
    return () => clearTimeout(t);
  }, [durationMs]);

  return (
    <div className="update-card">
      <div className="update-row">
        <span className="update-title">{message}</span>
        <button className="btn-undo" onClick={onUndo}>
          Undo
        </button>
        <button className="icon-btn" onClick={onClose} title="Dismiss">
          <XIcon size={16} />
        </button>
      </div>
      <div className="update-progress">
        <div
          className="update-progress-bar countdown"
          style={{ animationDuration: `${durationMs}ms` }}
        />
      </div>
    </div>
  );
}
