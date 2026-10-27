import "server-only";
import { hostOf } from "../text";
import type { MediaItem, Source } from "../types";
import { timed } from "./timing";

const UA = "Mozilla/5.0 (compatible; TimNewsBot/1.0; +https://github.com/timperkins/news)";

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { "user-agent": UA, ...(init.headers ?? {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Grounding links are Google redirects; follow one hop to find the real article URL. */
export async function resolveRedirect(uri: string): Promise<string | null> {
  if (!/grounding-api-redirect|vertexaisearch/.test(uri)) return uri;
  try {
    const res = await fetchWithTimeout(uri, { redirect: "manual" }, 5000);
    const location = res.headers.get("location");
    return location && /^https?:\/\//.test(location) ? location : null;
  } catch {
    return null;
  }
}

export interface PageMeta {
  title?: string;
  siteName?: string;
  image?: string;
  youtubeId?: string;
}

function metaContent(html: string, key: string): string | undefined {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${key}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return decodeEntities(m[1]);
  }
  return undefined;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function youtubeId(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const m = url.match(/(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=|v\/)|youtu\.be\/)([\w-]{11})/);
  return m?.[1];
}

/** Reads a page's Open Graph tags. Only the first ~300 KB is read. */
export async function pageMeta(url: string): Promise<PageMeta> {
  try {
    const res = await fetchWithTimeout(url, { headers: { accept: "text/html" } });
    if (!res.ok || !res.body) return {};
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let html = "";
    while (html.length < 300_000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (html.includes("</head>")) break;
    }
    reader.cancel().catch(() => {});
    const rawImage = metaContent(html, "og:image") ?? metaContent(html, "twitter:image");
    const image = rawImage ? new URL(rawImage, url).toString() : undefined;
    return {
      title: metaContent(html, "og:title") ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim(),
      siteName: metaContent(html, "og:site_name"),
      image: image?.startsWith("https://") ? image : undefined,
      youtubeId: youtubeId(metaContent(html, "og:video:url") ?? metaContent(html, "og:video")),
    };
  } catch {
    return {};
  }
}

/** Lead image for a Wikipedia article, hosted on upload.wikimedia.org. */
export async function wikipediaImage(name: string): Promise<MediaItem | null> {
  try {
    const res = await fetchWithTimeout(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g, "_"))}`,
      { headers: { accept: "application/json" } },
      5000,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      type?: string;
      title?: string;
      thumbnail?: { source?: string };
      originalimage?: { source?: string };
      content_urls?: { desktop?: { page?: string } };
    };
    if (data.type === "disambiguation") return null;
    const src = data.thumbnail?.source ?? data.originalimage?.source;
    if (!src) return null;
    // Ask for a wider rendition of the same thumbnail when possible.
    const url = src.replace(/\/(\d+)px-/, "/800px-");
    return {
      type: "image",
      url,
      pageUrl: data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(name)}`,
      credit: `${data.title ?? name}, via Wikipedia`,
    };
  } catch {
    return null;
  }
}

/** Resolves grounding links into real sources and collects linked media from them. */
export async function buildSourcesAndMedia(
  raw: { uri: string; title: string }[],
  entities: string[],
  maxSources = 5,
  /** Keep only pages that loaded and have a title (for URLs the model wrote itself). */
  requireLive = false,
  /** Labels the timing log lines for each phase. */
  logFields: Record<string, unknown> = {},
): Promise<{ sources: Source[]; media: MediaItem[] }> {
  const seenHosts = new Set<string>();
  const resolved: { url: string; fallbackTitle: string }[] = [];
  const toResolve = raw.slice(0, 10);
  const urls = await timed("resolveRedirects", { ...logFields, count: toResolve.length }, () =>
    Promise.all(toResolve.map((s) => resolveRedirect(s.uri))),
  );
  urls.forEach((url, i) => {
    if (!url) return;
    const host = hostOf(url);
    if (!host || seenHosts.has(host)) return;
    seenHosts.add(host);
    resolved.push({ url, fallbackTitle: raw[i].title });
  });
  const candidates = resolved.slice(0, maxSources);
  const allMetas = await timed("pageMeta", { ...logFields, count: candidates.length }, () =>
    Promise.all(candidates.map((s) => pageMeta(s.url))),
  );
  const keep = candidates.map((_, i) => !requireLive || Boolean(allMetas[i].title));
  const picked = candidates.filter((_, i) => keep[i]);
  const metas = allMetas.filter((_, i) => keep[i]);

  const sources: Source[] = picked.map((s, i) => ({
    url: s.url,
    title: metas[i].title?.slice(0, 200) || s.fallbackTitle || hostOf(s.url),
    outlet: metas[i].siteName?.slice(0, 60) || s.fallbackTitle || hostOf(s.url),
  }));

  const media: MediaItem[] = [];
  metas.forEach((m, i) => {
    if (m.youtubeId && !media.some((x) => x.type === "youtube")) {
      media.push({ type: "youtube", url: m.youtubeId, pageUrl: sources[i].url, credit: sources[i].outlet });
    }
    if (m.image && media.filter((x) => x.type === "image").length < 2) {
      media.push({ type: "image", url: m.image, pageUrl: sources[i].url, credit: sources[i].outlet });
    }
  });
  const wiki = await timed("wikipedia", { ...logFields, count: Math.min(entities.length, 2) }, () =>
    Promise.all(entities.slice(0, 2).map(wikipediaImage)),
  );
  for (const item of wiki) if (item && !media.some((m) => m.url === item.url)) media.push(item);

  return { sources, media: media.slice(0, 4) };
}
