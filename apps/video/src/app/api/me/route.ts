import { requireUser } from "@/lib/firebase/admin";
import { withErrors } from "@/lib/server/http";

/** Tells the browser whether the signed-in account may use the app. */
export const GET = withErrors(async (request: Request) => {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return Response.json({ email: user.email });
});
