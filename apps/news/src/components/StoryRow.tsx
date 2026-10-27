import Link from "next/link";
import { timeAgo } from "@/lib/text";
import type { Story } from "@/lib/types";
import { LinkedImage, MediaFigure } from "./Media";

function firstImage(story: Story) {
  return story.media?.find((m) => m.type === "image");
}

function outlets(story: Story) {
  const names = story.sources.map((s) => s.outlet);
  return names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", ");
}

export function StoryMeta({ story, showBreaking = true }: { story: Story; showBreaking?: boolean }) {
  return (
    <div className="meta">
      {showBreaking && story.isBreaking && <span className="breaking-dot">Breaking · </span>}
      {outlets(story)} · {timeAgo(story.publishedAt)}
    </div>
  );
}

export function StoryRow({ story, showDek = false }: { story: Story; showDek?: boolean }) {
  const image = firstImage(story);
  return (
    <Link href={`/story/${story.id}`} className="row">
      <div>
        <h3>{story.headline}</h3>
        {showDek && story.dek && <p>{story.dek}</p>}
        <StoryMeta story={story} />
      </div>
      {image && <LinkedImage item={image} className="thumb" />}
    </Link>
  );
}

export function LeadStory({ story, label }: { story: Story; label?: string }) {
  const hasMedia = story.media?.length > 0;
  return (
    <article className={`lead${hasMedia ? " with-media" : ""}`}>
      {hasMedia && (
        <div className="lead-media">
          <MediaFigure media={story.media} />
        </div>
      )}
      <div style={{ display: "grid", gap: 10 }}>
        {label && <span className={story.isBreaking ? "kicker" : "kicker quiet"}>{label}</span>}
        <Link href={`/story/${story.id}`}>
          <h2>{story.headline}</h2>
        </Link>
        {story.dek && <p className="dek">{story.dek}</p>}
        <StoryMeta story={story} showBreaking={!label} />
      </div>
    </article>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div className="skeleton" key={i}>
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}
