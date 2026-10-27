import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { FORCED_REFRESH_MIN_MS, FRESHNESS_MS, LOCK_MS, TOPICS, dailyLimit } from "../config";
import { adminDb } from "../firebase/admin";
import { newestFirst, sortStories } from "../ranking";
import { clampText, slugify } from "../text";
import type { Feed, FeedKind, Story } from "../types";

export interface FeedRequest {
  id: string;
  label?: string;
}

export interface FeedSpec {
  id: string;
  kind: FeedKind;
  label: string;
}

/** Checks a requested feed id and works out its label. Returns null for anything unknown. */
export async function resolveFeed(request: FeedRequest): Promise<FeedSpec | null> {
  const id = String(request.id ?? "");
  if (id === "global") return { id, kind: "global", label: "Top stories" };

  const topic = id.match(/^topic:([a-z0-9-]{2,40})$/);
  if (topic) {
    const slug = topic[1];
    // Use the reader's wording for the label only when it matches the slug.
    const offered = clampText(request.label, 40).replace(/[^\p{L}\p{N} &'.-]/gu, "");
    const label = TOPICS[slug] ?? (slugify(offered) === slug ? offered : slug.replace(/-/g, " "));
    return { id, kind: "topic", label };
  }

  const local = id.match(/^local:([a-z0-9-]{2,60})$/);
  if (local) {
    // Local feeds exist only for regions the location API has created.
    const region = await adminDb().collection("regions").doc(local[1]).get();
    if (!region.exists) return null;
    return { id, kind: "local", label: String(region.get("label") ?? local[1]) };
  }
  return null;
}

export type ClaimResult = "claimed" | "fresh" | "busy" | "waiting";

/**
 * Claims the right to refresh a feed if it is stale and nobody else is refreshing it.
 * "claimed" means this caller should run the refresh; "busy" means another run is in progress.
 * A forced claim (pull-to-refresh) only needs the last run to be FORCED_REFRESH_MIN_MS old.
 */
export async function claimFeed(spec: FeedSpec, { force = false, now = Date.now() } = {}): Promise<ClaimResult> {
  const db = adminDb();
  const ref = db.collection("feeds").doc(spec.id);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const feed = snap.data() as Partial<Feed> | undefined;
    const freshFor = force ? FORCED_REFRESH_MIN_MS : FRESHNESS_MS[spec.kind];
    if ((feed?.lockedUntil ?? 0) > now) return "busy";
    if ((feed?.retryAfter ?? 0) > now) return "waiting";
    if ((feed?.lastGeneratedAt ?? 0) > now - freshFor) return "fresh";
    tx.set(
      ref,
      {
        id: spec.id,
        kind: spec.kind,
        label: spec.label,
        lockedUntil: now + LOCK_MS,
        storyIds: feed?.storyIds ?? [],
        lastGeneratedAt: feed?.lastGeneratedAt ?? 0,
      },
      { merge: true },
    );
    return "claimed";
  });
}

/** Counts generations against a daily cap. Returns false when the cap is reached. */
export async function takeBudget(kind: "stories" | "followups", amount = 1): Promise<boolean> {
  const db = adminDb();
  const day = new Date().toISOString().slice(0, 10);
  const ref = db.collection("meta").doc(`budget-${day}`);
  const limit = dailyLimit(kind);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const used = Number(snap.get(kind) ?? 0);
    if (used + amount > limit) return false;
    tx.set(ref, { [kind]: FieldValue.increment(amount) }, { merge: true });
    return true;
  });
}

export async function getStories(ids: string[]): Promise<Story[]> {
  if (!ids.length) return [];
  const db = adminDb();
  const snaps = await db.getAll(...ids.map((id) => db.collection("stories").doc(id)));
  return snaps.filter((s) => s.exists).map((s) => ({ ...(s.data() as Story), id: s.id }));
}

export async function getFeedStories(feedId: string): Promise<{ feed: Feed | null; stories: Story[] }> {
  const snap = await adminDb().collection("feeds").doc(feedId).get();
  if (!snap.exists) return { feed: null, stories: [] };
  const feed = snap.data() as Feed;
  const stories = await getStories(feed.storyIds ?? []);
  return { feed, stories: sortStories(stories) };
}

export async function getStory(id: string): Promise<Story | null> {
  if (!/^[\w-]{1,80}$/.test(id)) return null;
  const snap = await adminDb().collection("stories").doc(id).get();
  return snap.exists ? ({ ...(snap.data() as Story), id: snap.id } as Story) : null;
}

const CATEGORY_PAGE_LIMIT = 300;

/**
 * Every stored story for a category page, newest first: stories written for the feed itself,
 * plus (for fixed topics) stories from any feed tagged with that topic.
 */
export async function getCategoryStories(feedId: string): Promise<Story[]> {
  const stories = adminDb().collection("stories");
  const topic = feedId.match(/^topic:(.+)$/)?.[1];
  const queries = [stories.where("feedIds", "array-contains", feedId)];
  if (topic && TOPICS[topic]) queries.push(stories.where("topics", "array-contains", topic));
  const snaps = await Promise.all(queries.map((q) => q.limit(CATEGORY_PAGE_LIMIT).get()));
  const byId = new Map<string, Story>();
  for (const snap of snaps) for (const d of snap.docs) byId.set(d.id, { ...(d.data() as Story), id: d.id });
  return newestFirst([...byId.values()]).slice(0, CATEGORY_PAGE_LIMIT);
}

/** Display name for a topic or local feed, or null if there's no such feed. */
export async function categoryLabel(feedId: string): Promise<string | null> {
  const topic = feedId.match(/^topic:(.+)$/)?.[1];
  if (topic && TOPICS[topic]) return TOPICS[topic];
  const db = adminDb();
  const local = feedId.match(/^local:(.+)$/)?.[1];
  if (local) {
    const region = await db.collection("regions").doc(local).get();
    return region.exists ? String(region.get("label") ?? local) : null;
  }
  const feed = await db.collection("feeds").doc(feedId).get();
  return feed.exists ? String(feed.get("label") ?? topic) : null;
}
