import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, getAdminLoginPath } from "@/lib/auth";

/**
 * Middleware verifies the session cookie on protected routes.
 *
 * We use `jose` directly here (instead of importing from lib/auth) because
 * the middleware runs in the Edge runtime and we need to keep imports minimal
 * and Edge-compatible.
 */
import { jwtVerify } from "jose";

function getSecret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

async function isValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}

/** First path segment when it's a 2-letter region code, else "". */
function regionFromPath(pathname: string): string {
  const first = pathname.split("/")[1] || "";
  return /^[a-z]{2}$/i.test(first) ? first.toLowerCase() : "";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Expose the URL region to server components (used to set <html lang>).
  const region = regionFromPath(pathname);
  const forwardHeaders = new Headers(request.headers);
  if (region) forwardHeaders.set("x-region-country", region);
  const pass = () =>
    NextResponse.next({ request: { headers: forwardHeaders } });

  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/api/transactions") ||
    pathname.startsWith("/api/admin");

  const loggedIn = await isValidSession(request);

  // Already logged in → visiting the admin login page should bounce to /dashboard.
  if (pathname === getAdminLoginPath() && loggedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Not logged in → protected route.
  // Deliberately do NOT redirect to the admin login here: that would reveal the
  // secret login URL to any anonymous visitor probing /dashboard. APIs get 401;
  // pages are sent to the public home. Admins reach the login via its secret URL.
  if (isProtectedRoute && !loggedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  return pass();
}

/**
 * Matcher: run on all routes EXCEPT static assets and Next.js internals.
 */
export const config = {
  matcher: [
    "/((?!_next|favicon\\.ico).*)",
  ],
};
