// Shared data shapes for Firestore documents and API payloads.

export type FeedKind = "global" | "topic" | "local";

export interface Source {
  url: string;
  title: string;
  outlet: string;
}

export interface MediaItem {
  type: "image" | "youtube";
  /** Image URL or YouTube video id. Always hosted elsewhere; never copied. */
  url: string;
  /** Page the media came from, linked in the credit line. */
  pageUrl: string;
  credit: string;
}

export interface FollowupSuggestion {
  id: string;
  title: string;
  blurb: string;
}

export interface Story {
  id: string;
  headline: string;
  dek: string;
  /** Paragraphs separated by blank lines. */
  body: string;
  keyFacts: string[];
  topics: string[];
  tags: string[];
  /** Wikipedia article titles for the main people, places and things. */
  entities: string[];
  significance: number;
  isBreaking: boolean;
  feedIds: string[];
  sources: Source[];
  media: MediaItem[];
  followups: FollowupSuggestion[];
  /** Milliseconds since epoch. */
  publishedAt: number;
  /** When the event itself happened (ms since epoch). Stories written before this field existed lack it. */
  happenedAt?: number;
  region?: string;
}

export interface Feed {
  id: string;
  kind: FeedKind;
  label: string;
  storyIds: string[];
  lastGeneratedAt: number;
  /** Last time storyIds changed, including stories published while a refresh is still running. */
  updatedAt?: number;
  lockedUntil: number;
  retryAfter: number;
}

export interface Followup {
  id: string;
  parentId: string;
  suggestionId: string;
  title: string;
  body: string;
  sources: Source[];
  media: MediaItem[];
  followups: FollowupSuggestion[];
  topics: string[];
  entities: string[];
  status: "generating" | "ready" | "failed";
  lockedUntil: number;
  createdAt: number;
}

export interface Interest {
  label: string;
  weight: number;
  pinned: boolean;
  muted: boolean;
  /** Milliseconds since epoch, used for decay. */
  updatedAt: number;
}

export interface Region {
  key: string;
  label: string;
}

export interface UserProfile {
  interests: Record<string, Interest>;
  region?: Region | null;
  settings: { trackingPaused: boolean; localEnabled: boolean };
}
