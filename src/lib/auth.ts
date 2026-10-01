/**
 * Auth utilities — JWT session management with the `jose` library.
 *
 * Server-side only. Never import this from client components.
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SESSION_COOKIE_NAME = "session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

// ---------------------------------------------------------------------------
// Admin login path (kept unguessable / off the public site)
// ---------------------------------------------------------------------------

/** Static base segment of the admin login route (`/<base>/<slug>`). */
export const ADMIN_LOGIN_BASE = "admin";

/**
 * Fallback slug used only when ADMIN_LOGIN_SLUG is not set. Still non-obvious so
 * a missing env var doesn't fall back to a guessable `/login`. Override it in
 * production via the ADMIN_LOGIN_SLUG environment variable.
 */
const DEFAULT_ADMIN_LOGIN_SLUG = "control-9f2a7c1b";

/** The secret path segment that unlocks the admin login page. */
export function getAdminLoginSlug(): string {
  return (process.env.ADMIN_LOGIN_SLUG || DEFAULT_ADMIN_LOGIN_SLUG)
    .trim()
    .replace(/^\/+|\/+$/g, "");
}

/** Full admin login path, e.g. `/admin/<slug>`. Never link to this publicly. */
export function getAdminLoginPath(): string {
  return `/${ADMIN_LOGIN_BASE}/${getAdminLoginSlug()}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is not set.");
  }
  return new TextEncoder().encode(secret);
}

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

export interface SessionPayload extends JWTPayload {
  /** The admin username that logged in. */
  username: string;
}

/**
 * Create a signed JWT containing the session payload.
 */
export async function createSessionToken(
  username: string,
): Promise<string> {
  const secret = getAuthSecret();
  return new SignJWT({ username } satisfies SessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secret);
}

/**
 * Verify and decode a session JWT. Returns the payload on success, or `null`
 * if the token is invalid / expired.
 */
export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret());
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cookie options
// ---------------------------------------------------------------------------

export function sessionCookieOptions() {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
