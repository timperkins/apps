import {
  BREAKING_TARGET,
  BREAKING_WINDOW_MS,
  EVENT_MAX_AGE_MS,
  HOME_BREAKING_COUNT,
  HOME_BREAKING_MAX_AGE_MS,
  HOME_BREAKING_MIN,
  HOME_CATEGORY_COUNT,
} from "./config";
import type { Story } from "./types";

/** Newsworthiness score used to order feeds: importance first, then freshness. */
export function storyScore(story: Pick<Story, "significance" | "publishedAt" | "isBreaking">, now = Date.now()) {
  const hours = Math.max(0, (now - story.publishedAt) / 3_600_000);
  const recency = Math.exp(-hours / 12);
  return (story.isBreaking ? 0.3 : 0) + 0.5 * story.significance + 0.2 * recency;
}

export function sortStories<T extends Pick<Story, "significance" | "publishedAt" | "isBreaking">>(
  stories: T[],
  now = Date.now(),
): T[] {
  return [...stories].sort((a, b) => storyScore(b, now) - storyScore(a, now));
}

/** How many more recent breaking stories a feed needs to reach BREAKING_TARGET. */
export function breakingShortfall(stories: Pick<Story, "publishedAt" | "isBreaking">[], now = Date.now()): number {
  const recent = stories.filter((s) => s.isBreaking && now - s.publishedAt < BREAKING_WINDOW_MS).length;
  return Math.max(0, BREAKING_TARGET - recent);
}

type Dated = Pick<Story, "significance" | "publishedAt" | "isBreaking" | "happenedAt">;

/** How long ago the story's event happened, falling back to when the story was written. */
export function eventAge(story: Pick<Story, "publishedAt" | "happenedAt">, now = Date.now()): number {
  return now - (story.happenedAt ?? story.publishedAt);
}

/**
 * The home page's top block: the most important breaking stories from the last two days.
 * When there are fewer than HOME_BREAKING_MIN, recent top stories fill the gap.
 */
export function homeBreaking<T extends Dated>(stories: T[], now = Date.now()): T[] {
  const recent = sortStories(
    stories.filter((s) => eventAge(s, now) < HOME_BREAKING_MAX_AGE_MS && now - s.publishedAt < HOME_BREAKING_MAX_AGE_MS),
    now,
  );
  const breaking = recent.filter((s) => s.isBreaking).slice(0, HOME_BREAKING_COUNT);
  const fill = recent.filter((s) => !s.isBreaking).slice(0, Math.max(0, HOME_BREAKING_MIN - breaking.length));
  return [...breaking, ...fill];
}

/** A category's home-page picks: its best stories about events from the last week. */
export function freshCategoryStories<T extends Dated>(stories: T[], count = HOME_CATEGORY_COUNT, now = Date.now()): T[] {
  return sortStories(
    stories.filter((s) => eventAge(s, now) < EVENT_MAX_AGE_MS),
    now,
  ).slice(0, count);
}

/** Newest first, for a category's full archive. */
export function newestFirst<T extends Pick<Story, "publishedAt">>(stories: T[]): T[] {
  return [...stories].sort((a, b) => b.publishedAt - a.publishedAt);
}
