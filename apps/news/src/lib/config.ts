// App-wide settings. Server-only values are read from the environment at call time.

export const APP_NAME = "Tim News";

/** Firestore database the app reads and writes (a named database, not "(default)"). */
export const FIRESTORE_DATABASE_ID = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID || "tim-news";

/** Fixed topic list the AI tags stories with, so interests stay consistent. */
export const TOPICS: Record<string, string> = {
  world: "World",
  "us-news": "U.S.",
  politics: "Politics",
  business: "Business",
  technology: "Technology",
  science: "Science",
  space: "Space",
  health: "Health",
  climate: "Climate",
  sports: "Sports",
  entertainment: "Entertainment",
  culture: "Culture",
  travel: "Travel",
  food: "Food",
  history: "History",
};

/** How long each kind of feed stays fresh before a visit triggers a refresh. */
export const FRESHNESS_MS = {
  global: 15 * 60_000,
  topic: 30 * 60_000,
  local: 60 * 60_000,
} as const;

/** How many new stories one refresh may write. */
export const BATCH_SIZE = { global: 6, topic: 4, local: 4 } as const;

/** How many stories one refresh writes at the same time (enough for a whole batch). */
export const STORY_CONCURRENCY = 6;

/** A pull-to-refresh can regenerate a feed this soon after the last run, even while it is fresh. */
export const FORCED_REFRESH_MIN_MS = 2 * 60_000;

/** The top-stories feed aims to always hold this many breaking stories from the last BREAKING_WINDOW_MS. */
export const BREAKING_TARGET = 3;
export const BREAKING_WINDOW_MS = 12 * 60 * 60_000;

/** Home page: up to this many breaking stories, none older than HOME_BREAKING_MAX_AGE_MS. */
export const HOME_BREAKING_COUNT = 4;
export const HOME_BREAKING_MIN = 3;
export const HOME_BREAKING_MAX_AGE_MS = 2 * 24 * 60 * 60_000;

/** Home page: stories per interest section, about events no older than EVENT_MAX_AGE_MS. */
export const HOME_CATEGORY_COUNT = 3;
/** A story about an event older than this is never written, and never shown on the home page. */
export const EVENT_MAX_AGE_MS = 7 * 24 * 60 * 60_000;

/** Interest sections shown to readers who haven't picked any interests yet. */
export const DEFAULT_INTERESTS = ["technology", "science", "health"];

export const LOCK_MS = 4 * 60_000;
export const RETRY_AFTER_FAILURE_MS = 5 * 60_000;
export const MAX_FEED_STORIES = 30;
export const STORY_MAX_AGE_MS = 3 * 24 * 60 * 60_000;
export const STORY_TTL_MS = 30 * 24 * 60 * 60_000;

export function geminiModel(): string {
  return process.env.GEMINI_MODEL || "gemini-flash-latest";
}

/**
 * Gemini thinking level for story generation: minimal, low, medium or high. "default" leaves
 * it to the model. Low keeps calls fast; each call already researches with Google Search.
 */
export function geminiThinking(): string | null {
  const raw = (process.env.GEMINI_THINKING || "low").trim().toUpperCase();
  return ["MINIMAL", "LOW", "MEDIUM", "HIGH"].includes(raw) ? raw : null;
}

export function dailyLimit(kind: "stories" | "followups"): number {
  const raw =
    kind === "stories" ? process.env.DAILY_STORY_LIMIT : process.env.DAILY_FOLLOWUP_LIMIT;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 200;
}
