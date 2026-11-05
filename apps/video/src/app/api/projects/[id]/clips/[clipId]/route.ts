import { requireUser } from "@/lib/firebase/admin";
import { withErrors } from "@/lib/server/http";
import { completeUpload, uploadStatus } from "@/lib/server/store";

type Ctx = RouteContext<"/api/projects/[id]/clips/[clipId]">;

/** How many bytes Cloud Storage already has for this clip. */
export const GET = withErrors(async (request: Request, ctx: Ctx) => {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id, clipId } = await ctx.params;
  const status = await uploadStatus(id, clipId);
  if (!status) return Response.json({ error: "Clip not found." }, { status: 404 });
  return Response.json(status);
});

/** Marks the clip uploaded after checking the stored object's size. */
export const POST = withErrors(async (request: Request, ctx: Ctx) => {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id, clipId } = await ctx.params;
  try {
    const clip = await completeUpload(id, clipId);
    if (!clip) return Response.json({ error: "Clip not found." }, { status: 404 });
    return Response.json({ clip });
  } catch (error) {
    return Response.json({ error: `Upload isn't complete yet: ${(error as Error).message}` }, { status: 409 });
  }
});
