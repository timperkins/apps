import "server-only";
import { STORY_TTL_MS } from "../config";
import { adminDb } from "../firebase/admin";
import { clampText, extractJson, shortHash, slugify } from "../text";
export { followupId } from "../ids";
import type { Followup, FollowupSuggestion, Story } from "../types";
import { groundedStream } from "./gemini";
import { buildSourcesAndMedia } from "./media";
import { takeBudget } from "./store";

export const SUGGESTIONS_MARKER = "===KEEP-LEARNING===";

export interface FollowupParent {
  id: string;
  headline: string;
  summary: string;
  topics: string[];
  entities: string[];
  suggestion: FollowupSuggestion;
}

/** Finds the story or follow-up a suggestion belongs to. */
export async function loadParent(parentId: string, suggestionId: string): Promise<FollowupParent | null> {
  if (!/^[\w-]{1,80}$/.test(parentId) || !/^[\w-]{1,80}$/.test(suggestionId)) return null;
  const db = adminDb();
  const collection = parentId.startsWith("f-") ? "followups" : "stories";
  const snap = await db.collection(collection).doc(parentId).get();
  if (!snap.exists) return null;
  const data = snap.data() as Partial<Story & Followup>;
  const suggestion = (data.followups ?? []).find((f) => f.id === suggestionId);
  if (!suggestion) return null;
  return {
    id: parentId,
    headline: data.headline ?? data.title ?? "",
    summary: data.dek ?? (data.body ?? "").slice(0, 400),
    topics: data.topics ?? [],
    entities: data.entities ?? [],
    suggestion,
  };
}

/** Claims generation of a follow-up. Returns the existing doc when it is ready or in progress. */
export async function claimFollowup(
  id: string,
  parent: FollowupParent,
): Promise<{ claimed: boolean; existing?: Followup }> {
  const db = adminDb();
  const ref = db.collection("followups").doc(id);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.data() as Followup | undefined;
    const now = Date.now();
    if (existing?.status === "ready") return { claimed: false, existing };
    if (existing?.status === "generating" && existing.lockedUntil > now) return { claimed: false, existing };
    tx.set(ref, {
      id,
      parentId: parent.id,
      suggestionId: parent.suggestion.id,
      title: parent.suggestion.title,
      body: "",
      sources: [],
      media: [],
      followups: [],
      topics: parent.topics,
      entities: parent.entities,
      status: "generating",
      lockedUntil: now + 3 * 60_000,
      createdAt: now,
    } satisfies Followup);
    return { claimed: true };
  });
}

function prompt(parent: FollowupParent): string {
  return `You write short "keep learning" explainer articles for the news app Tim News.

A reader just read this news story:
"${parent.headline}" - ${parent.summary}

Write an explainer titled "${parent.suggestion.title}" (${parent.suggestion.blurb}).
Use Google Search to check facts. Write 350 to 550 words in plain, friendly language for a curious adult.
Format: short paragraphs separated by blank lines. You may use "## " subheadings. Do not repeat the title.

After the article, write a line containing only ${SUGGESTIONS_MARKER} and then a JSON array of 3 ideas for further explainers that go deeper:
[{"title": "", "blurb": "one sentence"}]`;
}

/**
 * Streams the article text (without the trailing suggestions) and saves the finished follow-up.
 * Yields text deltas for the reader.
 */
export async function* generateFollowup(id: string, parent: FollowupParent): AsyncGenerator<string> {
  const ref = adminDb().collection("followups").doc(id);
  try {
    if (!(await takeBudget("followups"))) throw new Error("Daily follow-up limit reached");
    let full = "";
    let emitted = 0;
    let rawSources: { uri: string; title: string }[] = [];
    for await (const chunk of groundedStream(prompt(parent))) {
      full += chunk.text;
      if (chunk.sources.length) rawSources = [...rawSources, ...chunk.sources];
      // Hold back enough characters that a partially streamed marker is never shown.
      const markerAt = full.indexOf(SUGGESTIONS_MARKER);
      const safeEnd = markerAt >= 0 ? markerAt : Math.max(emitted, full.length - SUGGESTIONS_MARKER.length);
      if (safeEnd > emitted) {
        yield full.slice(emitted, safeEnd);
        emitted = safeEnd;
      }
    }
    const markerAt = full.indexOf(SUGGESTIONS_MARKER);
    const body = (markerAt >= 0 ? full.slice(0, markerAt) : full).trim();
    if (markerAt < 0 && full.length > emitted) yield full.slice(emitted);

    const ideas = markerAt >= 0 ? extractJson<{ title?: string; blurb?: string }[]>(full.slice(markerAt)) : null;
    const followups: FollowupSuggestion[] = (Array.isArray(ideas) ? ideas : [])
      .map((f) => ({ title: clampText(f?.title, 120), blurb: clampText(f?.blurb, 240) }))
      .filter((f) => f.title)
      .slice(0, 3)
      .map((f) => ({ ...f, id: slugify(f.title, 50) || shortHash(f.title) }));

    const { sources, media } = await buildSourcesAndMedia(rawSources, parent.entities, 4);
    await ref.set(
      {
        body: clampText(body, 8000),
        sources,
        media: media.filter((m) => m.type === "image").slice(0, 2),
        followups,
        status: "ready",
        lockedUntil: 0,
        expireAt: new Date(Date.now() + STORY_TTL_MS),
      },
      { merge: true },
    );
  } catch (error) {
    console.error(`[tim-news] follow-up ${id} failed`, error);
    await ref.set({ status: "failed", lockedUntil: 0 }, { merge: true });
    throw error;
  }
}
