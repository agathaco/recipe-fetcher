import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { sessions } from "@/db/schema";
import { AUTH_COOKIE, sessionId } from "@/app/lib/auth";

// Next 16 renamed Middleware to Proxy. Same thing: code that runs before every
// matched request: look up the session, redirect to /login if it's missing,
// unknown, or expired. This is the authentication gate only, "is somebody
// signed in." It says nothing about *who*, and it never scopes data by
// owner, that's the data layer's job now (see app/lib/session.ts's
// getCurrentUser and every WHERE ownerId = ... in app/lib/data.ts and
// actions.ts). A real per-row authorization check has to happen next to the
// query that touches the row; the proxy can't know which rows a page or
// action is about to read or write.
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const valid = token ? await hasValidSession(token) : false;

  if (!valid) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// The cookie holds a raw token; the DB only ever stores its hash. A row with
// no matching id means "never issued, or already revoked" (logout deletes the
// row). A row whose `expiresAt` has passed is lazily swept here, on the next
// request that presents it, rather than by a scheduled job.
async function hasValidSession(token: string): Promise<boolean> {
  const id = await sessionId(token);
  const [row] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  if (!row) return false;

  if (row.expiresAt.getTime() <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return false;
  }

  return true;
}

export const config = {
  // Run on everything except Next internals, static assets, and the login
  // and signup routes themselves (which have to stay reachable while signed
  // out, that's the whole point of them).
  matcher: ["/((?!login|signup|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
