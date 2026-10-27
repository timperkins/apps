"use client";

import { doc, onSnapshot, type DocumentSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition } from "react";
import { clientDb, firebaseConfigured } from "@/lib/firebase/client";
import { useAuth } from "./AuthProvider";

const THRESHOLD = 64;
const MAX_PULL = 96;
/** Longest the spinner waits for the first new story before showing what's already there. */
const SPINNER_MAX_MS = 45_000;
/** After a pull, stories that land later are shown right away instead of behind the "new stories" pill. */
const FOLLOW_MS = 4 * 60_000;

const RefreshContext = createContext({ refreshing: false, following: false });

/**
 * refreshing: a pull-to-refresh is fetching. following: a pull happened recently, so newly
 * written stories should be shown as they land.
 */
export function usePullRefresh() {
  return useContext(RefreshContext);
}

/** When the feed's story list last changed. */
export function feedVersion(snap: DocumentSnapshot): number {
  return Math.max(Number(snap.get("updatedAt") ?? 0), Number(snap.get("lastGeneratedAt") ?? 0));
}

/** Resolves once the feed changes after `since`, or after `timeoutMs`. */
function waitForFeed(feedId: string, since: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    let unsubscribe = () => {};
    const done = () => {
      clearTimeout(timer);
      unsubscribe();
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    unsubscribe = onSnapshot(
      doc(clientDb(), "feeds", feedId),
      (snap) => {
        if (feedVersion(snap) > since) done();
      },
      done,
    );
  });
}

/**
 * Pull down from the top of the page to fetch fresh stories. Forces a regeneration of the
 * top-stories feed (which tops itself up with breaking news). Writing a batch takes a minute
 * or two, so the spinner only waits for the first new story; later ones appear as they land.
 */
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const { user, authedFetch } = useAuth();
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [fetching, setFetching] = useState(false);
  const [following, setFollowing] = useState(false);
  const [rendering, startTransition] = useTransition();
  const refreshing = fetching || rendering;
  const start = useRef<number | null>(null);
  const pullRef = useRef(0);
  const followTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(followTimer.current), []);

  const refresh = useCallback(async () => {
    setFetching(true);
    try {
      if (user && firebaseConfigured) {
        const startedAt = Date.now();
        setFollowing(true);
        clearTimeout(followTimer.current);
        followTimer.current = setTimeout(() => setFollowing(false), FOLLOW_MS);
        // The request runs until the whole batch is written; don't hold the spinner for it.
        const request = authedFetch("/api/refresh", {
          method: "POST",
          body: JSON.stringify({ feeds: [{ id: "global" }], force: true }),
        })
          .then(async (res) => {
            const { busy } = (await res.json().catch(() => ({}))) as { busy?: string[] };
            // Another run is already writing stories; keep waiting for those to land.
            if (busy?.includes("global")) await new Promise(() => {});
          })
          .catch((error) => console.error("Pull-to-refresh failed", error));
        await Promise.race([request, waitForFeed("global", startedAt, SPINNER_MAX_MS)]);
      }
    } finally {
      startTransition(() => router.refresh());
      setFetching(false);
    }
  }, [user, authedFetch, router]);

  useEffect(() => {
    const setDistance = (d: number) => {
      pullRef.current = d;
      setPull(d);
    };
    const onStart = (e: TouchEvent) => {
      start.current = window.scrollY <= 0 && e.touches.length === 1 ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (start.current === null || refreshing) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0 || window.scrollY > 0) {
        if (pullRef.current) setDistance(0);
        return;
      }
      // Resist the pull so it feels elastic, and keep the page from scrolling meanwhile.
      if (e.cancelable) e.preventDefault();
      setDistance(Math.min(MAX_PULL, dy * 0.5));
    };
    const onEnd = () => {
      if (start.current === null) return;
      start.current = null;
      const triggered = pullRef.current >= THRESHOLD;
      setDistance(0);
      if (triggered && !refreshing) void refresh();
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [refresh, refreshing]);

  const visible = refreshing || pull > 0;
  const progress = Math.min(1, pull / THRESHOLD);
  return (
    <RefreshContext.Provider value={{ refreshing, following }}>
      <div className="ptr-root">
        <div
          className={`ptr${refreshing ? " ptr-loading" : ""}`}
          style={{
            opacity: refreshing ? 1 : progress,
            transform: `translate(-50%, ${refreshing ? 0 : pull - 40}px)`,
            visibility: visible ? "visible" : "hidden",
          }}
          role="status"
          aria-live="polite"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)` }}>
            <circle cx="12" cy="12" r="9" />
          </svg>
          <span className="visually-hidden">{refreshing ? "Fetching new stories" : ""}</span>
        </div>
        {children}
      </div>
    </RefreshContext.Provider>
  );
}
