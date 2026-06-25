import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

/** Check for an available update. Returns null when up to date or unavailable
 *  (e.g. running in a dev/browser context without the updater configured). */
export async function checkForUpdate(): Promise<Update | null> {
  try {
    return await check();
  } catch (e) {
    console.error("[updater] check failed", e);
    return null;
  }
}

/** Download + install an update, reporting progress (0–100), then relaunch. */
export async function installUpdate(
  update: Update,
  onProgress?: (percent: number) => void
): Promise<void> {
  let total = 0;
  let received = 0;
  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        total = event.data.contentLength ?? 0;
        break;
      case "Progress":
        received += event.data.chunkLength;
        if (total > 0) onProgress?.(Math.min(100, Math.round((received / total) * 100)));
        break;
      case "Finished":
        onProgress?.(100);
        break;
    }
  });
  await relaunch();
}
