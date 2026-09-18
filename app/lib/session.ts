import "server-only";

// Re-derives "who is this request" from the session cookie, the same lookup
// proxy.ts already does before this ever runs. Next has no clean way to pass
// data from a Proxy function across to a Server Component or Action, so this
// repeats that query rather than threading it through headers, consistent
// with how this app already treats database reads: cheap, done freely, on
// every page (see INTERVIEW.md Q31 on that exact cost).
//
// Doesn't re-check `expiresAt`: proxy.ts already gates every route except
// /login and /signup, so by the time a Server Component or Action runs, a
// session row existing for this token means proxy.ts already confirmed it
// wasn't expired on this same request. Re-checking here would just repeat
// work proxy.ts already guaranteed.

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { AUTH_COOKIE, sessionId } from "@/app/lib/auth";

export type CurrentUser = { id: string; email: string };

// React.cache so a page whose generateMetadata and page body both need the
// current user (the recipe detail page does) share one query per request
// instead of two, same reasoning as getRecipeById in data.ts.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value;
  if (!token) return null;

  const id = await sessionId(token);
  const [row] = await db
    .select({ id: users.id, email: users.email })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id))
    .limit(1);

  return row ?? null;
});

// Convenience for Server Components/Actions that can't proceed without a
// signed-in user, which is nearly everything except /login and /signup
// themselves: redirects instead of making every caller repeat the same
// "if (!user) redirect(...)" check.
export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
