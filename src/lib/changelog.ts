// The changelog is the same RELEASE_NOTES.md that drives the in-app update card,
// bundled at build time so "What's New" always matches the release you're on.
import raw from "../../RELEASE_NOTES.md?raw";

export interface ChangelogEntry {
  /** e.g. "0.1.0" (empty if no version found in the heading). */
  version: string;
  /** The full heading text, e.g. "What's new in v0.1.0". */
  title: string;
  /** The notes under the heading. */
  body: string;
}

/** Parse the bundled RELEASE_NOTES.md into newest-first version entries. */
export function parseChangelog(): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  let current: ChangelogEntry | null = null;

  for (const line of raw.split("\n")) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      if (current) entries.push(current);
      const title = heading[1];
      const v = title.match(/\d+\.\d+\.\d+/);
      current = { version: v ? v[0] : "", title, body: "" };
    } else if (current) {
      current.body += line + "\n";
    }
  }
  if (current) entries.push(current);

  return entries.map((e) => ({ ...e, body: e.body.trim() }));
}
