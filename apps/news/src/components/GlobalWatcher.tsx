"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clientDb, firebaseConfigured } from "@/lib/firebase/client";
import { useAuth } from "./AuthProvider";
import { feedVersion, usePullRefresh } from "./PullToRefresh";

/**
 * Asks the server to refresh the global feed if it is stale, then watches it.
 * New stories show a "New stories" button instead of reshuffling the page.
 */
export function GlobalWatcher({ renderedAt, hasStories }: { renderedAt: number; hasStories: boolean }) {
  const { user, authedFetch } = useAuth();
  const router = useRouter();
  const { refreshing, following } = usePullRefresh();
  const [latest, setLatest] = useState(0);
  // Compared against renderedAt, so the pill goes away once the page re-renders with the new stories.
  const newer = latest > renderedAt && hasStories && !refreshing && !following;

  // Right after a pull-to-refresh, show stories as they land instead of offering the pill.
  useEffect(() => {
    if (following && !refreshing && latest > renderedAt) router.refresh();
  }, [following, refreshing, latest, renderedAt, router]);

  useEffect(() => {
    if (!user) return;
    authedFetch("/api/refresh", { method: "POST", body: JSON.stringify({ feeds: [{ id: "global" }] }) }).catch(() => {});
  }, [user, authedFetch]);

  useEffect(() => {
    if (!firebaseConfigured) return;
    return onSnapshot(doc(clientDb(), "feeds", "global"), (snap) => {
      const version = feedVersion(snap);
      if (version > renderedAt) {
        // Fill an empty page right away; otherwise let the reader choose when.
        if (hasStories) setLatest(version);
        else router.refresh();
      }
    });
  }, [renderedAt, hasStories, router]);

  if (!newer) return null;
  return (
    <button
      className="pill"
      onClick={() => {
        router.refresh();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    >
      Show new stories
    </button>
  );
}
