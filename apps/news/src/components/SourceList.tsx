import type { Source } from "@/lib/types";

export function SourceList({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <section className="sources">
      <h2>Sources</h2>
      <ol>
        {sources.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.title}
            </a>{" "}
            <span>({s.outlet})</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
