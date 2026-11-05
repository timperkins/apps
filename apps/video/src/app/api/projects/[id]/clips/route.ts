import { requireUser } from "@/lib/firebase/admin";
import { withErrors } from "@/lib/server/http";
import { startUpload } from "@/lib/server/store";

/** Starts or resumes one file's upload and returns its resumable session URL. */
export const POST = withErrors(async (request: Request, ctx: RouteContext<"/api/projects/[id]/clips">) => {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    fileName?: unknown;
    size?: unknown;
    contentType?: unknown;
    restart?: unknown;
  };
  const fileName = typeof body.fileName === "string" ? body.fileName.slice(0, 255) : "";
  const size = typeof body.size === "number" && Number.isSafeInteger(body.size) ? body.size : 0;
  const contentType = typeof body.contentType === "string" ? body.contentType.slice(0, 100) : "";
  if (!fileName || size <= 0) return Response.json({ error: "Missing file name or size." }, { status: 400 });

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const ticket = await startUpload(id, { fileName, size, contentType }, origin, body.restart === true);
  if (!ticket) return Response.json({ error: "Project not found." }, { status: 404 });
  return Response.json(ticket);
});
