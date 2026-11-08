import Link from "next/link";
import { cookies } from "next/headers";
import { loadHeadlines } from "@/lib/server/feeds";
import { parseSourceIds, sourcesById, SOURCES_COOKIE } from "@/lib/sources";
import { timeAgo } from "@/lib/time";

export default async function Home() {
  const ids = parseSourceIds((await cookies()).get(SOURCES_COOKIE)?.value);
  const sources = sourcesById(ids);

  if (sources.length === 0) {
    return (
      <p className="empty">
        No sources picked. <Link href="/sources">Choose some sources</Link> to see headlines.
      </p>
    );
  }

  const { headlines, failed, fetchedAt } = await loadHeadlines(sources);

  return (
    <>
      <p className="from">
        From {sources.map((s) => s.name).join(", ")}. <Link href="/sources">Change</Link>
      </p>
      {failed.length > 0 && (
        <p className="notice">Couldn&apos;t load {failed.map((s) => s.name).join(", ")} right now.</p>
      )}
      {headlines.length === 0 ? (
        <p className="empty">No headlines right now. Try again in a minute.</p>
      ) : (
        <ol className="headlines">
          {headlines.map((h) => (
            <li key={`${h.sourceId}:${h.url}`}>
              <a href={h.url} target="_blank" rel="noopener noreferrer">{h.title}</a>
              <div className="meta">
                <span>{h.publisher ?? h.sourceName}</span>
                {h.publisher && <span>via {h.sourceName}</span>}
                {h.publishedAt && <time dateTime={h.publishedAt}>{timeAgo(h.publishedAt, fetchedAt)}</time>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
