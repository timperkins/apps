// The headline sources a reader can pick from. Each one is an RSS or Atom feed.
export interface Source {
  id: string;
  name: string;
  feedUrl: string;
  homepage: string;
}

export const SOURCES: Source[] = [
  {
    id: "google-news",
    name: "Google News",
    feedUrl: "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en",
    homepage: "https://news.google.com",
  },
  {
    id: "the-verge",
    name: "The Verge",
    feedUrl: "https://www.theverge.com/rss/index.xml",
    homepage: "https://www.theverge.com",
  },
  {
    id: "bbc",
    name: "BBC News",
    feedUrl: "https://feeds.bbci.co.uk/news/rss.xml",
    homepage: "https://www.bbc.com/news",
  },
  {
    id: "npr",
    name: "NPR",
    feedUrl: "https://feeds.npr.org/1001/rss.xml",
    homepage: "https://www.npr.org",
  },
  {
    id: "nyt",
    name: "The New York Times",
    feedUrl: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
    homepage: "https://www.nytimes.com",
  },
  {
    id: "guardian",
    name: "The Guardian",
    feedUrl: "https://www.theguardian.com/world/rss",
    homepage: "https://www.theguardian.com",
  },
  {
    id: "ars-technica",
    name: "Ars Technica",
    feedUrl: "https://feeds.arstechnica.com/arstechnica/index",
    homepage: "https://arstechnica.com",
  },
  {
    id: "techcrunch",
    name: "TechCrunch",
    feedUrl: "https://techcrunch.com/feed/",
    homepage: "https://techcrunch.com",
  },
  {
    id: "hacker-news",
    name: "Hacker News",
    feedUrl: "https://hnrss.org/frontpage",
    homepage: "https://news.ycombinator.com",
  },
];

export const DEFAULT_SOURCE_IDS = ["google-news", "the-verge", "bbc", "npr"];

// The reader's picks are kept in a cookie as a comma-separated list of source ids.
export const SOURCES_COOKIE = "sources";

export function parseSourceIds(value: string | undefined): string[] {
  if (value === undefined) return DEFAULT_SOURCE_IDS;
  const known = new Set(SOURCES.map((s) => s.id));
  return [...new Set(value.split(",").map((id) => id.trim()))].filter((id) => known.has(id));
}

export function sourcesById(ids: string[]): Source[] {
  return SOURCES.filter((s) => ids.includes(s.id));
}
