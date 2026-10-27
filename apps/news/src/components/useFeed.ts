"use client";

import { collection, doc, documentId, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { clientDb, firebaseConfigured } from "@/lib/firebase/client";
import { sortStories } from "@/lib/ranking";
import type { Feed, Story } from "@/lib/types";

export interface FeedState {
  stories: Story[];
  loading: boolean;
  lastGeneratedAt: number;
  generating: boolean;
}

/** Live view of a feed's stories, read straight from Firestore. */
export function useFeedStories(feedId: string | null, limit = 6): FeedState {
  const [state, setState] = useState<FeedState>({ stories: [], loading: true, lastGeneratedAt: 0, generating: false });

  useEffect(() => {
    if (!feedId || !firebaseConfigured) return;
    let cancelled = false;
    const db = clientDb();
    const unsubscribe = onSnapshot(
      doc(db, "feeds", feedId),
      async (snap) => {
        const feed = snap.data() as Feed | undefined;
        const ids = (feed?.storyIds ?? []).slice(0, limit);
        const generating = (feed?.lockedUntil ?? 0) > Date.now();
        const stories: Story[] = [];
        for (let i = 0; i < ids.length; i += 10) {
          const chunk = ids.slice(i, i + 10);
          const result = await getDocs(query(collection(db, "stories"), where(documentId(), "in", chunk)));
          result.forEach((d) => stories.push({ ...(d.data() as Story), id: d.id }));
        }
        if (!cancelled) {
          setState({ stories: sortStories(stories), loading: false, lastGeneratedAt: feed?.lastGeneratedAt ?? 0, generating });
        }
      },
      () => !cancelled && setState((s) => ({ ...s, loading: false })),
    );
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [feedId, limit]);

  return feedId ? state : { stories: [], loading: false, lastGeneratedAt: 0, generating: false };
}
