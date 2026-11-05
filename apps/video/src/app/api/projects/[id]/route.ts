import { requireUser } from "@/lib/firebase/admin";
import { withErrors } from "@/lib/server/http";
import { getProject, updateProject } from "@/lib/server/store";

export const GET = withErrors(async (request: Request, ctx: RouteContext<"/api/projects/[id]">) => {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id } = await ctx.params;
  const result = await getProject(id);
  if (!result) return Response.json({ error: "Project not found." }, { status: 404 });
  return Response.json(result);
});

export const PATCH = withErrors(async (request: Request, ctx: RouteContext<"/api/projects/[id]">) => {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { name?: unknown; notes?: unknown };
  const patch: { name?: string; notes?: string } = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 120);
  if (typeof body.notes === "string") patch.notes = body.notes.slice(0, 5000);
  if (!(await getProject(id))) return Response.json({ error: "Project not found." }, { status: 404 });
  await updateProject(id, patch);
  return Response.json({ ok: true });
});
