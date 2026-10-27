import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArticleBody } from "@/components/ArticleBody";
import { MediaFigure } from "@/components/Media";
import { SourceList } from "@/components/SourceList";
import { FollowupList, ReadTracker, TopicChips } from "@/components/StoryExtras";
import { Skeleton } from "@/components/StoryRow";
import { TOPICS } from "@/lib/config";
import { getStory } from "@/lib/server/store";
import { timeAgo } from "@/lib/text";

async function StoryArticle({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const story = await getStory(id);
  if (!story) notFound();

  const kicker = story.isBreaking ? "Breaking" : (TOPICS[story.topics[0]] ?? "News");
  return (
    <article className="narrow article">
      <ReadTracker topics={story.topics} />
      <header>
        <span className={story.isBreaking ? "kicker" : "kicker quiet"}>{kicker}</span>
        <h1>{story.headline}</h1>
        {story.dek && <p className="dek">{story.dek}</p>}
        <div className="byline">
          An AI-written summary of reporting from {story.sources.map((s) => s.outlet).join(", ")}. Updated{" "}
          {timeAgo(story.publishedAt)}.
        </div>
      </header>
      <MediaFigure media={story.media} />
      <div style={{ height: 18 }} />
      <ArticleBody text={story.body} />
      {story.keyFacts.length > 0 && (
        <aside className="facts">
          <h2>Key facts</h2>
          <ul>
            {story.keyFacts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </aside>
      )}
      <SourceList sources={story.sources} />
      <TopicChips topics={story.topics} tags={story.tags} />
      <FollowupList parentId={story.id} suggestions={story.followups} topics={story.topics} />
    </article>
  );
}

export default function StoryPage({ params }: PageProps<"/story/[id]">) {
  return (
    <Suspense fallback={<div className="narrow"><Skeleton rows={4} /></div>}>
      <StoryArticle params={params} />
    </Suspense>
  );
}
