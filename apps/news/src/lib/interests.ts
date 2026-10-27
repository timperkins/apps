// Pure interest-weight logic. The client applies these updates to the user's Firestore doc.

import { TOPICS } from "./config";
import { slugify } from "./text";
import type { Interest, Story } from "./types";

export const MAX_INTERESTS = 30;
const DAILY_DECAY = 0.97;
const DAY_MS = 24 * 60 * 60_000;

export type Signal = "open" | "read" | "topicTap" | "followupTap";

export const SIGNAL_WEIGHT: Record<Signal, number> = {
  open: 0.05,
  read: 0.1,
  topicTap: 0.2,
  followupTap: 0.3,
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Weight after time-based decay. Pinned interests never fade. */
export function effectiveWeight(interest: Interest, now = Date.now()): number {
  if (interest.pinned) return Math.max(interest.weight, 0.5);
  const days = Math.max(0, (now - interest.updatedAt) / DAY_MS);
  return clamp01(interest.weight * Math.pow(DAILY_DECAY, days));
}

/** Returns a new interest map with the signal applied to each topic. */
export function applySignal(
  interests: Record<string, Interest>,
  topics: string[],
  signal: Signal,
  now = Date.now(),
): Record<string, Interest> {
  const next = { ...interests };
  for (const topic of topics) {
    const key = slugify(topic);
    if (!key) continue;
    const current = next[key];
    if (current?.muted) continue;
    // Only fixed topics are added automatically; free-text interests come from the user.
    if (!current && !TOPICS[key]) continue;
    const base = current ? effectiveWeight(current, now) : 0;
    next[key] = {
      label: current?.label ?? TOPICS[key] ?? topic,
      weight: clamp01(base + SIGNAL_WEIGHT[signal]),
      pinned: current?.pinned ?? false,
      muted: false,
      updatedAt: now,
    };
  }
  return prune(next, now);
}

/** Keeps the map small by dropping the weakest unpinned interests. */
export function prune(interests: Record<string, Interest>, now = Date.now()) {
  const entries = Object.entries(interests);
  if (entries.length <= MAX_INTERESTS) return interests;
  const removable = entries
    .filter(([, i]) => !i.pinned && !i.muted)
    .sort((a, b) => effectiveWeight(a[1], now) - effectiveWeight(b[1], now));
  const next = { ...interests };
  for (const [key] of removable.slice(0, entries.length - MAX_INTERESTS)) delete next[key];
  return next;
}

export function addInterest(
  interests: Record<string, Interest>,
  label: string,
  now = Date.now(),
): Record<string, Interest> {
  const key = slugify(label);
  if (!key) return interests;
  const existing = interests[key];
  return prune(
    {
      ...interests,
      [key]: {
        label: existing?.label ?? (TOPICS[key] || label.trim().slice(0, 40)),
        weight: Math.max(existing ? effectiveWeight(existing, now) : 0, 0.6),
        pinned: existing?.pinned ?? false,
        muted: false,
        updatedAt: now,
      },
    },
    now,
  );
}

/** Changes pin or mute flags on one interest. */
export function updateInterest(
  interests: Record<string, Interest>,
  key: string,
  change: Partial<Pick<Interest, "pinned" | "muted">>,
  now = Date.now(),
): Record<string, Interest> {
  const current = interests[key];
  if (!current) return interests;
  return { ...interests, [key]: { ...current, weight: effectiveWeight(current, now), ...change, updatedAt: now } };
}

/** Interests sorted strongest first, without muted ones. */
export function topInterests(
  interests: Record<string, Interest> | undefined,
  count: number,
  now = Date.now(),
): { key: string; label: string; weight: number }[] {
  return Object.entries(interests ?? {})
    .filter(([, i]) => !i.muted)
    .map(([key, i]) => ({ key, label: i.label, weight: effectiveWeight(i, now) }))
    .filter((i) => i.weight > 0.05)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, count);
}

/** How well a story or follow-up matches the reader's interests, 0..1. */
export function interestMatch(
  item: Pick<Story, "topics" | "tags">,
  interests: Record<string, Interest> | undefined,
  now = Date.now(),
): number {
  if (!interests) return 0;
  let best = 0;
  for (const raw of [...(item.topics ?? []), ...(item.tags ?? [])]) {
    const interest = interests[slugify(raw)];
    if (interest && !interest.muted) best = Math.max(best, effectiveWeight(interest, now));
  }
  return best;
}
