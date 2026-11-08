import { requireUser } from "@/lib/firebase/admin";
import { withErrors } from "@/lib/server/http";
import { createProject, listProjects } from "@/lib/server/store";

export const GET = withErrors(async (request: Request) => {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return Response.json({ projects: await listProjects() });
});

export const POST = withErrors(async (request: Request) => {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const body = (await request.json().catch(() => ({}))) as { name?: unknown; notes?: unknown };
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const notes = typeof body.notes === "string" ? body.notes.slice(0, 5000) : "";
  if (!name) return Response.json({ error: "Give the project a name." }, { status: 400 });
  return Response.json({ project: await createProject(name, notes, user.uid) }, { status: 201 });
});
