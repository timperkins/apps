import { requireUser } from "@/lib/firebase/admin";
import { withErrors } from "@/lib/server/http";
import { processClip } from "@/lib/server/store";

/** Starts (or restarts) the processing job for an uploaded clip. `{"indexOnly": true}` only re-indexes. */
export const POST = withErrors(
  async (request: Request, ctx: RouteContext<"/api/projects/[id]/clips/[clipId]/process">) => {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const { id, clipId } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as { indexOnly?: boolean };
    const processing = await processClip(id, clipId, { indexOnly: body.indexOnly === true });
    if (!processing) return Response.json({ error: "Upload the clip first." }, { status: 409 });
    return Response.json({ processing });
  },
);
