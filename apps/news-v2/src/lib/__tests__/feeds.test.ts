import { describe, expect, it } from "vitest";
import { parseFeed, sortHeadlines } from "@/lib/server/feeds";
import type { Source } from "@/lib/sources";

const source: Source = { id: "test", name: "Test", feedUrl: "https://example.com/feed", homepage: "https://example.com" };

describe("parseFeed", () => {
  it("reads RSS items and strips the Google News publisher suffix", () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"><channel><title>Top</title>
        <item>
          <title>Big storm hits coast - Example Times</title>
          <link>https://news.example.com/a</link>
          <pubDate>Mon, 02 Nov 2026 18:00:00 GMT</pubDate>
          <source url="https://times.example.com">Example Times</source>
        </item>
        <item><title><![CDATA[Rates & markets]]></title><link>https://news.example.com/b</link></item>
      </channel></rss>`;
    expect(parseFeed(xml, source)).toEqual([
      {
        title: "Big storm hits coast",
        url: "https://news.example.com/a",
        sourceId: "test",
        sourceName: "Test",
        publisher: "Example Times",
        publishedAt: "2026-11-02T18:00:00.000Z",
      },
      { title: "Rates & markets", url: "https://news.example.com/b", sourceId: "test", sourceName: "Test", publisher: undefined, publishedAt: undefined },
    ]);
  });

  it("reads a single-item RSS feed and decodes entities", () => {
    const xml = `<rss><channel><item><title>It&#8217;s here &amp; now</title><link>https://x.example/1</link></item></channel></rss>`;
    expect(parseFeed(xml, source).map((h) => h.title)).toEqual(["It’s here & now"]);
  });

  it("reads Atom entries and picks the alternate link", () => {
    const xml = `<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title type="html">New phone review</title>
          <link rel="replies" href="https://verge.example/a#comments"/>
          <link rel="alternate" type="text/html" href="https://verge.example/a"/>
          <published>2026-11-02T12:00:00-05:00</published>
        </entry>
      </feed>`;
    expect(parseFeed(xml, source)).toEqual([
      {
        title: "New phone review",
        url: "https://verge.example/a",
        sourceId: "test",
        sourceName: "Test",
        publisher: undefined,
        publishedAt: "2026-11-02T17:00:00.000Z",
      },
    ]);
  });

  it("skips items without a title or http link", () => {
    const xml = `<rss><channel><item><link>https://x.example/1</link></item><item><title>No link</title><link>javascript:alert(1)</link></item></channel></rss>`;
    expect(parseFeed(xml, source)).toEqual([]);
  });
});

describe("sortHeadlines", () => {
  it("puts newest first and undated last", () => {
    const h = (title: string, publishedAt?: string) => ({ title, url: "https://x", sourceId: "s", sourceName: "S", publishedAt });
    const sorted = sortHeadlines([h("undated"), h("old", "2026-11-01T00:00:00Z"), h("new", "2026-11-02T00:00:00Z")]);
    expect(sorted.map((x) => x.title)).toEqual(["new", "old", "undated"]);
  });
});
