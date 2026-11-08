import type { Metadata } from "next";
import { cookies } from "next/headers";
import { saveSources } from "@/app/actions";
import { parseSourceIds, SOURCES, SOURCES_COOKIE } from "@/lib/sources";

export const metadata: Metadata = { title: "Sources" };

export default async function SourcesPage() {
  const selected = new Set(parseSourceIds((await cookies()).get(SOURCES_COOKIE)?.value));

  return (
    <form action={saveSources} className="sources">
      <h1>Sources</h1>
      <p>Pick where your headlines come from.</p>
      <ul>
        {SOURCES.map((s) => (
          <li key={s.id}>
            <label>
              <input type="checkbox" name="source" value={s.id} defaultChecked={selected.has(s.id)} />
              <span>{s.name}</span>
            </label>
          </li>
        ))}
      </ul>
      <button type="submit">Save</button>
    </form>
  );
}
