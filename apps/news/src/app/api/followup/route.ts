import { verifyRequest } from "@/lib/firebase/admin";
import { claimFollowup, followupId, generateFollowup, loadParent } from "@/lib/server/followups";

export const maxDuration = 120;

/**
 * Returns a follow-up article, generating it on first request. New articles stream as
 * newline-delimited JSON: {"type":"start"|"delta"|"done"|"error", ...}.
 */
export async function POST(request: Request) {
  const uid = await verifyRequest(request);
  if (!uid) return Response.json({ error: "Sign-in required" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { parentId?: string; suggestionId?: string };
  const parent = await loadParent(String(body.parentId ?? ""), String(body.suggestionId ?? ""));
  if (!parent) return Response.json({ error: "Follow-up not found" }, { status: 404 });

  const id = followupId(parent.id, parent.suggestion.id);
  const { claimed, existing } = await claimFollowup(id, parent);
  if (!claimed) {
    // Ready or being written by another request; the page watches the Firestore doc.
    return Response.json({ id, status: existing?.status ?? "generating" });
  }

  const encoder = new TextEncoder();
  const line = (value: unknown) => encoder.encode(JSON.stringify(value) + "\n");
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(line({ type: "start", id, title: parent.suggestion.title }));
      try {
        for await (const text of generateFollowup(id, parent)) {
          controller.enqueue(line({ type: "delta", text }));
        }
        controller.enqueue(line({ type: "done", id }));
      } catch {
        controller.enqueue(line({ type: "error", message: "Couldn't write this article. Try again in a minute." }));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
