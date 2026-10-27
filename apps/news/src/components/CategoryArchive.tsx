import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { categoryLabel, getCategoryStories } from "@/lib/server/store";
import { StoryRow } from "./StoryRow";

/** Every stored story for one interest or local feed, newest first. */
export async function CategoryArchive({ feedId }: { feedId: string }) {
  await connection();
  const label = await categoryLabel(feedId);
  if (!label) notFound();
  const stories = await getCategoryStories(feedId);
  const title = feedId.startsWith("local:") ? `Local news in ${label}` : label;

  return (
    <section className="section">
      <div className="section-head">
        <h1 className="section-title">{title}</h1>
        <Link href="/">Home</Link>
      </div>
      {stories.length ? (
        <div className="story-grid">
          {stories.map((s) => (
            <StoryRow key={s.id} story={s} showDek />
          ))}
        </div>
      ) : (
        <div className="notice">No {label} stories yet. Check back soon.</div>
      )}
      {stories.length > 0 && <p className="feed-end">Looks like you&apos;ve reached the end</p>}
    </section>
  );
}
