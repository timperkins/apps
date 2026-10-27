// Small string helpers shared by the client and the server.

export function slugify(input: string, max = 40): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

/** Stable, short, non-cryptographic hash (FNV-1a, 2 rounds) for document ids. */
export function shortHash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x811c9dc5);
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}

/** Pulls the first JSON object or array out of model output, tolerating code fences and prose. */
export function extractJson<T = unknown>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], text];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const start = candidate.search(/[[{]/);
    if (start === -1) continue;
    const open = candidate[start];
    const close = open === "[" ? "]" : "}";
    const end = candidate.lastIndexOf(close);
    if (end <= start) continue;
    try {
      return JSON.parse(candidate.slice(start, end + 1)) as T;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Formats a past time as "12m ago", "3h ago" or a short date. */
export function timeAgo(ms: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - ms) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function clampText(input: unknown, max: number): string {
  return typeof input === "string" ? input.trim().slice(0, max) : "";
}

/** Reads the model's "YYYY-MM-DD" event date as midday UTC, never later than now. Null if missing or invalid. */
export function parseEventDate(raw: unknown, now = Date.now()): number | null {
  const match = typeof raw === "string" && raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return Number.isFinite(ms) ? Math.min(ms, now) : null;
}
