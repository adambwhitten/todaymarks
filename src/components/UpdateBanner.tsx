import { useEffect, useState } from "react";
import type { Update } from "@tauri-apps/plugin-updater";
import { checkForUpdate, installUpdate } from "@/lib/updater";
import { RefreshIcon, XIcon } from "./Icons";

type State =
  | { kind: "hidden" }
  | { kind: "available"; update: Update }
  | { kind: "installing"; update: Update; progress: number }
  | { kind: "error"; message: string };

/**
 * Quietly checks for an update on launch. If one is found, slides in a small
 * card offering to install it. Self-contained — renders nothing until there's
 * an update to show.
 */
export function UpdateBanner() {
  const [state, setState] = useState<State>({ kind: "hidden" });
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const update = await checkForUpdate();
      if (!cancelled && update) setState({ kind: "available", update });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "hidden") return null;

  async function install(update: Update) {
    setState({ kind: "installing", update, progress: 0 });
    try {
      await installUpdate(update, (progress) =>
        setState({ kind: "installing", update, progress })
      );
      // App relaunches on success; nothing more to do here.
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  if (state.kind === "error") {
    return (
      <div className="update-card">
        <div className="update-row">
          <span className="update-title">Update failed</span>
          <button className="icon-btn" onClick={() => setState({ kind: "hidden" })}>
            <XIcon size={16} />
          </button>
        </div>
        <div className="update-sub">{state.message}</div>
      </div>
    );
  }

  if (state.kind === "installing") {
    return (
      <div className="update-card">
        <div className="update-row">
          <RefreshIcon size={15} className="spin" />
          <span className="update-title">Updating… {state.progress}%</span>
        </div>
        <div className="update-progress">
          <div className="update-progress-bar" style={{ width: `${state.progress}%` }} />
        </div>
      </div>
    );
  }

  const { update } = state;
  return (
    <div className="update-card">
      <div className="update-row">
        <span className="update-dot" />
        <span className="update-title">Update available · v{update.version}</span>
        <button className="icon-btn" onClick={() => setState({ kind: "hidden" })}>
          <XIcon size={16} />
        </button>
      </div>
      {update.body && (
        <>
          <button
            className="update-notes-toggle"
            onClick={() => setShowNotes((s) => !s)}
          >
            {showNotes ? "Hide notes" : "What's new"}
          </button>
          {showNotes && <div className="update-notes">{update.body}</div>}
        </>
      )}
      <div className="update-actions">
        <button className="btn btn-primary" onClick={() => install(update)}>
          Update & Restart
        </button>
      </div>
    </div>
  );
}
