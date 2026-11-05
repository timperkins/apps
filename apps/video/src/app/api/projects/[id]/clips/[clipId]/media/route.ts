import { requireUser } from "@/lib/firebase/admin";
import { withErrors } from "@/lib/server/http";
import { clipMediaUrls } from "@/lib/server/store";

/** Signed links for watching a clip's proxy and comparing it with the original. */
export const GET = withErrors(
  async (request: Request, ctx: RouteContext<"/api/projects/[id]/clips/[clipId]/media">) => {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const { id, clipId } = await ctx.params;
    const urls = await clipMediaUrls(id, clipId);
    if (!urls) return Response.json({ error: "Clip not found." }, { status: 404 });
    return Response.json(urls);
  },
);
