import { verifyRequest } from "@/lib/firebase/admin";
import { refreshFeed } from "@/lib/server/pipeline";
import { claimFeed, resolveFeed, type FeedRequest } from "@/lib/server/store";

export const maxDuration = 300;

/**
 * Refreshes stale feeds. New stories land in Firestore and open pages pick them up through
 * their listeners, so callers don't wait on the response. The work runs inside the request,
 * not in after(): Cloud Run throttles CPU once a response is sent, and source-page fetches
 * made after the response all failed, so every story was dropped.
 */
export async function POST(request: Request) {
  const uid = await verifyRequest(request);
  if (!uid) return Response.json({ error: "Sign-in required" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { feeds?: FeedRequest[]; force?: boolean };
  const requested = Array.isArray(body.feeds) ? body.feeds.slice(0, 6) : [];
  // Pull-to-refresh forces a run even when the feed is fresh (within a short minimum gap).
  const force = body.force === true;

  const started: string[] = [];
  const busy: string[] = [];
  const runs: Promise<void>[] = [];
  for (const item of requested) {
    const spec = await resolveFeed(item);
    if (!spec) continue;
    const claim = await claimFeed(spec, { force });
    if (claim === "claimed") {
      started.push(spec.id);
      runs.push(refreshFeed(spec));
    } else if (claim === "busy") {
      busy.push(spec.id);
    }
  }
  await Promise.all(runs);
  return Response.json({ started, busy });
}
