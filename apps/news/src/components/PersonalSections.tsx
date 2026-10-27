"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { DEFAULT_INTERESTS, TOPICS } from "@/lib/config";
import { firebaseConfigured } from "@/lib/firebase/client";
import { topInterests } from "@/lib/interests";
import { freshCategoryStories } from "@/lib/ranking";
import { useAuth } from "./AuthProvider";
import { LocationCard } from "./LocationCard";
import { Skeleton, StoryRow } from "./StoryRow";
import { useFeedStories } from "./useFeed";

function FeedSection({
  feedId,
  title,
  moreHref,
  moreLabel,
  emptyText,
}: {
  feedId: string;
  title: React.ReactNode;
  moreHref: string;
  moreLabel: string;
  emptyText: string;
}) {
  // Read past the first few so stories about old events don't leave the section empty.
  const { stories: all, loading } = useFeedStories(feedId, 12);
  const stories = useMemo(() => freshCategoryStories(all), [all]);
  return (
    <section className="section">
      <div className="section-head">{title}</div>
      {loading ? (
        <Skeleton rows={2} />
      ) : stories.length ? (
        <div className="story-grid three">
          {stories.map((s) => (
            <StoryRow key={s.id} story={s} />
          ))}
        </div>
      ) : (
        <div className="notice">{all.length ? "Nothing new this week. Fresh stories will appear here shortly." : emptyText}</div>
      )}
      <Link href={moreHref} className="btn see-more">
        {moreLabel}
      </Link>
    </section>
  );
}

/** Local news and interest sections, built in the browser from the reader's profile. */
export function PersonalSections() {
  const { ready } = useAuth();
  // Rendered only in the browser, once the reader's profile has loaded.
  if (!firebaseConfigured || !ready) return null;
  return <PersonalFeeds />;
}

function PersonalFeeds() {
  const { user, profile, ready, authedFetch } = useAuth();
  const picked = useMemo(() => topInterests(profile.interests, 3), [profile.interests]);
  // Readers who haven't picked interests yet still get a few categories below the breaking news.
  const usingDefaults = picked.length === 0;
  const interests = useMemo(
    () => (usingDefaults ? DEFAULT_INTERESTS.map((key) => ({ key, label: TOPICS[key] })) : picked),
    [usingDefaults, picked],
  );
  const region = profile.settings.localEnabled ? profile.region : null;

  // Ask for fresh stories in each personal feed; the server ignores feeds that are still fresh.
  const feedsKey = JSON.stringify([region?.key, interests.map((i) => i.key)]);
  useEffect(() => {
    if (!user || !ready) return;
    const feeds = [
      ...(region ? [{ id: `local:${region.key}` }] : []),
      ...interests.map((i) => ({ id: `topic:${i.key}`, label: i.label })),
    ];
    if (feeds.length) {
      authedFetch("/api/refresh", { method: "POST", body: JSON.stringify({ feeds }) }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- feedsKey captures region and interests
  }, [user, ready, feedsKey, authedFetch]);

  return (
    <>
      {usingDefaults && (
        <div className="notice" style={{ marginTop: 26 }}>
          <Link href="/interests">Pick your interests</Link> to choose which categories show up here.
        </div>
      )}
      {interests.map((i) => (
        <FeedSection
          key={i.key}
          feedId={`topic:${i.key}`}
          title={
            <>
              <span>{usingDefaults ? i.label : `Based on your interest in ${i.label}`}</span>
              <Link href="/interests">Edit</Link>
            </>
          }
          moreHref={`/topic/${i.key}`}
          moreLabel={`More ${i.label}`}
          emptyText={`Writing up the latest on ${i.label}. Check back in a moment.`}
        />
      ))}
      {region ? (
        <FeedSection
          feedId={`local:${region.key}`}
          title={
            <>
              <span>Local news in {region.label}</span>
              <Link href="/interests#local">Change</Link>
            </>
          }
          moreHref={`/local/${region.key}`}
          moreLabel={`More from ${region.label}`}
          emptyText={`Finding local stories for ${region.label}. They'll appear here shortly.`}
        />
      ) : (
        <LocationCard />
      )}
    </>
  );
}
