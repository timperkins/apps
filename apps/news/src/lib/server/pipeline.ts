import "server-only";
import {
  BATCH_SIZE,
  EVENT_MAX_AGE_MS,
  HOME_BREAKING_MAX_AGE_MS,
  MAX_FEED_STORIES,
  RETRY_AFTER_FAILURE_MS,
  STORY_CONCURRENCY,
  STORY_MAX_AGE_MS,
  STORY_TTL_MS,
  TOPICS,
} from "../config";
import { adminDb } from "../firebase/admin";
import { breakingShortfall, sortStories } from "../ranking";
import { clampText, extractJson, parseEventDate, shortHash, slugify } from "../text";
import type { Feed, FollowupSuggestion, Story } from "../types";
import { groundedGenerate } from "./gemini";
import { buildSourcesAndMedia } from "./media";
import { getStories, takeBudget, type FeedSpec } from "./store";
import { logTiming, timed } from "./timing";

interface EventIdea {
  key: string;
  event: string;
  breaking?: boolean;
}

interface WrittenStory {
  headline?: string;
  dek?: string;
  body?: string;
  keyFacts?: string[];
  topics?: string[];
  tags?: string[];
  entities?: string[];
  significance?: number;
  breaking?: boolean;
  eventDate?: string;
  followups?: { title?: string; blurb?: string }[];
  sources?: { url?: string; title?: string }[];
}

const TOPIC_LIST = Object.keys(TOPICS).join(", ");

/** "Oct 12, 2026": the oldest date an event may have happened and still get a story. */
function oldestEventDate(now = Date.now()): string {
  return new Date(now - EVENT_MAX_AGE_MS).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function scopeLine(spec: FeedSpec): string {
  const recentOnly = `Only include events that happened on or after ${oldestEventDate()}. Skip anything older, even if it was written about recently.`;
  switch (spec.kind) {
    case "global":
      return "the most important news stories in the world right now, published in the last 24 hours. Put major breaking news first.";
    case "topic":
      return `the latest news about "${spec.label}" from the last 7 days. ${recentOnly}`;
    case "local":
      return `the latest local news for ${spec.label} from the last few days (city government, transit, weather, schools, business, community events). ${recentOnly}`;
  }
}

/**
 * Step 1: ask Gemini (with Google Search) which events to cover. When the feed is short of
 * breaking news, at least `breakingNeeded` of them must be breaking developments.
 */
async function findEvents(
  spec: FeedSpec,
  existingHeadlines: string[],
  count: number,
  breakingNeeded = 0,
): Promise<EventIdea[]> {
  const today = new Date().toUTCString();
  const breakingRule = breakingNeeded
    ? `\nAt least ${breakingNeeded} of them must be breaking news: major developments reported in the last few hours. List those first and mark them with "breaking": true.\n`
    : "";
  const prompt = `Today is ${today}. Use Google Search to find ${scopeLine(spec)}

Return up to ${count} distinct real news events that are NOT already covered by these headlines:
${existingHeadlines.length ? existingHeadlines.map((h) => `- ${h}`).join("\n") : "- (none yet)"}
${breakingRule}
Respond with only a JSON array, no other text:
[{"key": "short-kebab-case-id-for-the-event", "event": "one sentence describing what happened, with names, places and the date", "breaking": false}]`;
  const { text } = await groundedGenerate(prompt, { step: "findEvents", feed: spec.id });
  const parsed = extractJson<EventIdea[]>(text);
  if (!Array.isArray(parsed)) {
    console.warn(`[tim-news] no event list for ${spec.id}; model replied: ${text.slice(0, 500)}`);
    return [];
  }
  return parsed
    .map((e) => ({
      key: slugify(clampText(e?.key, 80), 60),
      event: clampText(e?.event, 400),
      breaking: e?.breaking === true,
    }))
    .filter((e) => e.key && e.event)
    .slice(0, count);
}

/** Step 2: write one story, grounded in search results that become its sources. */
async function writeStory(spec: FeedSpec, idea: EventIdea): Promise<Omit<Story, "id" | "feedIds"> | null> {
  const prompt = `You are a careful news writer for "Tim News". Use Google Search to research this event and write a news story about it:

"${idea.event}"
${idea.breaking ? "\nThis was flagged as breaking news. Set \"breaking\" to true if search confirms it is a major development from the last few hours.\n" : ""}
Rules:
- Use only facts you found in search results. Do not guess. Attribute claims ("officials said", "according to Reuters").
- Neutral, clear tone. 250 to 450 words in the body, split into short paragraphs separated by blank lines.
- "topics": 1 to 3 values chosen only from: ${TOPIC_LIST}.
- "tags": 2 to 5 short lowercase subject tags (for example "electric vehicles", "nasa").
- "entities": up to 3 exact English Wikipedia article titles for the main places, landmarks, people or organizations.
- "significance": 0 to 1, how important this is to a general audience (0.9+ only for major world events).
- "breaking": true only if this is a major development from the last few hours.
- "eventDate": the date the main event happened, as YYYY-MM-DD. This is when it happened, not when it was reported.
- "sources": the URLs of up to 5 news articles you used, exactly as they appeared in search results.
- "followups": 3 or 4 ideas for short explainer articles that help a reader learn more about the background (history, how it works, key people, what happens next). Each has a title and a one-sentence blurb.

Respond with only JSON, no other text:
{"headline": "", "dek": "one-sentence summary", "body": "", "keyFacts": ["", ""], "topics": [], "tags": [], "entities": [], "significance": 0.5, "breaking": false, "eventDate": "YYYY-MM-DD", "followups": [{"title": "", "blurb": ""}], "sources": [{"url": "", "title": ""}]}`;

  const log = { feed: spec.id, key: idea.key };
  const { text, sources: rawSources } = await groundedGenerate(prompt, { step: "writeStory", ...log });
  const written = extractJson<WrittenStory>(text);
  if (!written?.headline || !written.body) {
    console.warn(`[tim-news] dropped ${idea.key}: no headline or body; model replied: ${text.slice(0, 500)}`);
    return null;
  }

  // Old events dressed up as news (a year-old discovery, say) don't belong in the feed.
  const now = Date.now();
  const happenedAt = parseEventDate(written.eventDate, now);
  if (happenedAt && now - happenedAt > EVENT_MAX_AGE_MS) {
    console.warn(`[tim-news] dropped ${idea.key}: event happened ${written.eventDate}, too old`);
    return null;
  }

  const entities = (written.entities ?? []).map((e) => clampText(e, 100)).filter(Boolean);
  // Gemini often answers without grounding metadata; fall back to the article URLs it cites,
  // keeping only pages that actually load.
  const cited = (written.sources ?? [])
    .map((s) => ({ uri: clampText(s?.url, 500), title: clampText(s?.title, 200) }))
    .filter((s) => /^https?:\/\//.test(s.uri));
  const grounded = await timed("sources", { ...log, from: "grounding", links: rawSources.length }, () =>
    buildSourcesAndMedia(rawSources, entities, 5, false, log),
  );
  const { sources, media } = grounded.sources.length
    ? grounded
    : await timed("sources", { ...log, from: "cited", links: cited.length }, () =>
        buildSourcesAndMedia(cited, entities, 5, true, log),
      );
  // A story must be grounded in at least one real source page.
  if (!sources.length) {
    console.warn(
      `[tim-news] dropped ${idea.key}: none of ${rawSources.length} grounding links or ${cited.length} cited links resolved to a source`,
    );
    return null;
  }

  const followups: FollowupSuggestion[] = (written.followups ?? [])
    .map((f) => ({ title: clampText(f?.title, 120), blurb: clampText(f?.blurb, 240) }))
    .filter((f) => f.title)
    .slice(0, 4)
    .map((f) => ({ ...f, id: slugify(f.title, 50) || shortHash(f.title) }));

  const significance = Math.min(1, Math.max(0, Number(written.significance) || 0.3));
  return {
    headline: clampText(written.headline, 200),
    dek: clampText(written.dek, 300),
    body: clampText(written.body, 6000),
    keyFacts: (written.keyFacts ?? []).map((f) => clampText(f, 240)).filter(Boolean).slice(0, 5),
    topics: (written.topics ?? []).map((t) => slugify(String(t))).filter((t) => TOPICS[t]).slice(0, 3),
    tags: (written.tags ?? []).map((t) => clampText(t, 40).toLowerCase()).filter(Boolean).slice(0, 5),
    entities,
    significance,
    // Breaking needs more than one independent outlet. Events the search step flagged as
    // breaking get a slightly lower bar, so pull-to-refresh reliably surfaces some.
    isBreaking:
      Boolean(written.breaking) &&
      sources.length >= 2 &&
      significance >= (idea.breaking ? 0.5 : 0.6) &&
      (!happenedAt || now - happenedAt < HOME_BREAKING_MAX_AGE_MS),
    sources,
    media,
    followups,
    publishedAt: now,
    ...(happenedAt ? { happenedAt } : {}),
    ...(spec.kind === "local" ? { region: spec.id.slice("local:".length) } : {}),
  };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Generates new stories for a feed and saves them. Call only after claimFeed() returned true. */
export async function refreshFeed(spec: FeedSpec): Promise<void> {
  const db = adminDb();
  const feedRef = db.collection("feeds").doc(spec.id);
  const runStart = Date.now();
  const run = { feed: spec.id, ideas: 0, written: 0, reused: 0, dropped: 0, failed: 0, firstStoryMs: 0 };
  const sinceStart = () => Date.now() - runStart;
  try {
    const existing = await timed("loadFeed", { feed: spec.id }, async () => {
      const feed = (await feedRef.get()).data() as Feed | undefined;
      const now = Date.now();
      return (await getStories(feed?.storyIds ?? [])).filter((s) => now - s.publishedAt < STORY_MAX_AGE_MS);
    });
    const now = Date.now();

    const count = BATCH_SIZE[spec.kind];
    if (!(await timed("budget", { feed: spec.id }, () => takeBudget("stories", count)))) {
      throw new Error("Daily story limit reached");
    }

    // The top-stories feed always tops itself up to a few recent breaking stories.
    const breakingNeeded = spec.kind === "global" ? breakingShortfall(existing, now) : 0;
    const ideas = await timed("findEvents", { feed: spec.id, count, breakingNeeded }, () =>
      findEvents(spec, existing.map((s) => s.headline).slice(0, 25), count, breakingNeeded),
    );
    run.ideas = ideas.length;
    logTiming("eventsFound", { feed: spec.id, atMs: sinceStart(), ideas: ideas.length });
    const dayKey = new Date().toISOString().slice(0, 10);
    const newIds: string[] = [];

    const feedStoryIds = async () => {
      const merged = await getStories([...new Set([...newIds, ...existing.map((s) => s.id)])]);
      return sortStories(merged.filter((s) => Date.now() - s.publishedAt < STORY_MAX_AGE_MS))
        .slice(0, MAX_FEED_STORIES)
        .map((s) => s.id);
    };
    // Each story goes live as soon as it's written, so readers don't wait for the whole batch.
    // Publishes run one at a time so concurrent writers can't drop each other's stories.
    let publishing = Promise.resolve();
    const publish = () => {
      if (!run.firstStoryMs) run.firstStoryMs = sinceStart();
      publishing = publishing
        .then(async () => {
          await feedRef.set({ storyIds: await feedStoryIds(), updatedAt: Date.now() }, { merge: true });
        })
        .catch((error) => console.error(`[tim-news] couldn't publish a story to ${spec.id}`, error));
    };

    // Write the whole batch at once: each story is one ~30s Gemini call, so running them in
    // rounds of 3 added a full extra call to every refresh.
    await mapLimit(ideas, STORY_CONCURRENCY, async (idea) => {
      const id = `${dayKey.replace(/-/g, "")}-${shortHash(idea.key)}`;
      const ref = db.collection("stories").doc(id);
      const storyStart = Date.now();
      const startedAtMs = sinceStart();
      let outcome = "failed";
      try {
        const already = await ref.get();
        if (already.exists) {
          // Another feed already covered this event today; just list it here too.
          const feedIds = new Set<string>(already.get("feedIds") ?? []);
          feedIds.add(spec.id);
          await ref.update({ feedIds: [...feedIds] });
          newIds.push(id);
          publish();
          outcome = "reused";
          return;
        }
        const story = await writeStory(spec, idea);
        if (!story) {
          outcome = "dropped";
          return;
        }
        await timed("saveStory", { feed: spec.id, key: idea.key }, () =>
          ref.set({ ...story, id, feedIds: [spec.id], expireAt: new Date(Date.now() + STORY_TTL_MS) }),
        );
        newIds.push(id);
        publish();
        outcome = "written";
      } catch (error) {
        console.error(`[tim-news] story failed for ${spec.id}: ${idea.key}`, error);
      } finally {
        run[outcome as "written" | "reused" | "dropped" | "failed"]++;
        logTiming("story", {
          feed: spec.id,
          key: idea.key,
          outcome,
          startedAtMs,
          ms: Date.now() - storyStart,
          doneAtMs: sinceStart(),
        });
      }
    });

    // A run that pays for Gemini calls but saves nothing is a failure, not a fresh feed.
    if (!newIds.length && (ideas.length || !existing.length)) {
      throw new Error(`No stories written (${ideas.length} events found, all dropped)`);
    }

    await publishing;
    const storyIds = await feedStoryIds();
    const doneAt = Date.now();
    await feedRef.set(
      { storyIds, lastGeneratedAt: doneAt, updatedAt: doneAt, lockedUntil: 0, retryAfter: 0, lastError: null },
      { merge: true },
    );
    logTiming("refresh", { ...run, ok: true, ms: sinceStart() });
  } catch (error) {
    logTiming("refresh", { ...run, ok: false, ms: sinceStart() });
    console.error(`[tim-news] refresh failed for ${spec.id}`, error);
    await feedRef.set(
      {
        lockedUntil: 0,
        retryAfter: Date.now() + RETRY_AFTER_FAILURE_MS,
        lastError: error instanceof Error ? error.message : String(error),
      },
      { merge: true },
    );
  }
}
