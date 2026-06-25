/** Extract http(s) URLs from a blob of text (e.g. event notes). */
export function extractUrls(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = text.match(/https?:\/\/[^\s<>"')]+/g);
  if (!matches) return [];
  // De-dupe while preserving order.
  return Array.from(new Set(matches.map((u) => u.replace(/[.,;]+$/, ""))));
}

/** Shorten a URL for display (host + a little path). */
export function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    const tail = u.pathname.length > 1 ? u.pathname : "";
    const s = `${u.host}${tail}`;
    return s.length > 42 ? s.slice(0, 41) + "…" : s;
  } catch {
    return url.length > 42 ? url.slice(0, 41) + "…" : url;
  }
}
