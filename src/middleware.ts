import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtectedRoute =
    pathname.startsWith("/dashboard") || pathname.startsWith("/api/transactions");

  const loggedIn = await isValidSession(request);

  // Already logged in → visiting /login should bounce to /dashboard.
  if (pathname === "/login" && loggedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Not logged in → protected route → redirect to /login.
  if (isProtectedRoute && !loggedIn) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

/**
 * Matcher: run on all routes EXCEPT static assets and Next.js internals.
 */
export const config = {
  matcher: [
    "/((?!_next|favicon\\.ico).*)",
  ],
};
