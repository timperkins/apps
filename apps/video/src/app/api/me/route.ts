import { requireUser } from "@/lib/firebase/admin";

/** Tells the browser whether the signed-in account may use the app. */
export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return Response.json({ email: user.email });
}
