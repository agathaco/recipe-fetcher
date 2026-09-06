import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { AUTH_COOKIE, expectedAuthCookie } from "@/app/lib/auth";

// Next 16 renamed Middleware to Proxy. Same thing: code that runs before every
// matched request. This is the whole auth story for a one-user app: check a
// cookie, redirect to /login if it is wrong. A real multi-user app would also
// verify the session in the data layer, not trust the proxy alone.
export async function proxy(request: NextRequest) {
  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  const expected = await expectedAuthCookie();

  if (expected && cookie !== expected) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and the login route itself, which
  // has to stay reachable while signed out.
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
