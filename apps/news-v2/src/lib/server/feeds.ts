import "server-only";
import { XMLParser } from "fast-xml-parser";
import type { Source } from "@/lib/sources";

export interface Headline {
  title: string;
  url: string;
  sourceId: string;
  sourceName: string;
  // The outlet that wrote the story, when the feed aggregates others (Google News).
  publisher?: string;
  publishedAt?: string;
}

export interface HeadlinesResult {
  headlines: Headline[];
  failed: Source[];
  fetchedAt: number;
}

const MAX_PER_SOURCE = 30;
// Feeds are re-fetched at most this often, so a burst of visits doesn't hammer them.
const REVALIDATE_SECONDS = 60;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  htmlEntities: true,
  isArray: (name) => name === "item" || name === "entry" || name === "link",
});

type Node = Record<string, unknown>;

function text(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string" || typeof value === "number") return String(value).trim() || undefined;
  if (Array.isArray(value)) return text(value[0]);
  if (typeof value === "object") return text((value as Node)["#text"]);
  return undefined;
}

function isoDate(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? undefined : new Date(ms).toISOString();
}

// RSS <link> is text; Atom <link> is an element with href, possibly several with different rels.
function linkUrl(value: unknown): string | undefined {
  const links = Array.isArray(value) ? value : [value];
  for (const link of links) {
    if (typeof link === "string") return link.trim() || undefined;
  }
  const atom = links.filter((l): l is Node => typeof l === "object" && l !== null);
  const best = atom.find((l) => !l["@_rel"] || l["@_rel"] === "alternate") ?? atom[0];
  return text(best?.["@_href"]);
}

export function parseFeed(xml: string, source: Source): Headline[] {
  const doc = parser.parse(xml) as Node;
  const channel = (doc.rss as Node | undefined)?.channel as Node | undefined;
  const items = (channel?.item ?? (doc.feed as Node | undefined)?.entry ?? []) as Node[];

  const headlines: Headline[] = [];
  for (const item of items) {
    let title = text(item.title);
    const url = linkUrl(item.link) ?? text(item.guid);
    if (!title || !url || !/^https?:\/\//.test(url)) continue;

    const publisher = text(item.source);
    // Google News appends " - Publisher" to every title.
    if (publisher && title.endsWith(` - ${publisher}`)) {
      title = title.slice(0, -(publisher.length + 3)).trim();
    }

    headlines.push({
      title,
      url,
      sourceId: source.id,
      sourceName: source.name,
      publisher,
      publishedAt: isoDate(item.pubDate ?? item.published ?? item.updated ?? item["dc:date"]),
    });
    if (headlines.length >= MAX_PER_SOURCE) break;
  }
  return headlines;
}

async function fetchSource(source: Source): Promise<Headline[]> {
  const res = await fetch(source.feedUrl, {
    headers: { "User-Agent": "news-v2 (+https://news-v2.trom.dev)", Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(8000),
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) throw new Error(`${source.feedUrl}: HTTP ${res.status}`);
  return parseFeed(await res.text(), source);
}

// Newest first; headlines with no date go after dated ones, in feed order.
export function sortHeadlines(headlines: Headline[]): Headline[] {
  return headlines
    .map((h, i) => ({ h, i, t: h.publishedAt ? Date.parse(h.publishedAt) : -Infinity }))
    .sort((a, b) => b.t - a.t || a.i - b.i)
    .map(({ h }) => h);
}

export async function loadHeadlines(sources: Source[]): Promise<HeadlinesResult> {
  const results = await Promise.allSettled(sources.map(fetchSource));
  const headlines: Headline[] = [];
  const failed: Source[] = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") headlines.push(...result.value);
    else {
      failed.push(sources[i]);
      console.error(`Feed failed for ${sources[i].id}:`, result.reason);
    }
  });
  return { headlines: sortHeadlines(headlines), failed, fetchedAt: Date.now() };
}
