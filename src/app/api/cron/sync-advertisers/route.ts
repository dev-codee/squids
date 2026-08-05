import { NextRequest, NextResponse } from "next/server";
import { fetchProgrammes } from "@/lib/awin";

export const dynamic = "force-dynamic";

/**
 * Verify the request came from Vercel Cron (or an authorised caller).
 *
 * Vercel automatically attaches `Authorization: Bearer <CRON_SECRET>` to cron
 * invocations when a CRON_SECRET env var is set. We also accept `?secret=` as a
 * convenience for manual testing.
 */
function isAuthorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed if not configured

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const querySecret = request.nextUrl.searchParams.get("secret");
  return querySecret === secret;
}

/**
 * GET /api/cron/sync-advertisers
 *
 * Placeholder sync job. For now it re-fetches the joined advertisers and logs a
 * summary. Extend this later to persist advertisers/offers to a database or
 * cache so the UI can read from a fast local source.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const advertisers = await fetchProgrammes("joined");

    // TODO: persist to a database / cache and later sync offers & deals.
    console.log(
      `[cron/sync-advertisers] Synced ${advertisers.length} advertisers at ${new Date().toISOString()}`,
    );

    return NextResponse.json({
      ok: true,
      syncedAt: new Date().toISOString(),
      count: advertisers.length,
    });
  } catch (error) {
    console.error("[cron/sync-advertisers] Sync failed:", error);
    return NextResponse.json(
      { ok: false, error: "Sync failed." },
      { status: 500 },
    );
  }
}
