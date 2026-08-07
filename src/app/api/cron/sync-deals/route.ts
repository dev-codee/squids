import { NextRequest, NextResponse } from "next/server";
import { fetchDeals } from "@/lib/deals";
import {
  upsertDeals,
  removeExpiredDeals,
  removeStaleDeals,
} from "@/lib/db/deals";
import { updateSyncTime, recordSyncError } from "@/lib/db/sync-meta";

export const dynamic = "force-dynamic";

/**
 * Verify the request came from Vercel Cron (or an authorised caller).
 */
function isAuthorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const querySecret = request.nextUrl.searchParams.get("secret");
  return querySecret === secret;
}

/**
 * GET /api/cron/sync-deals
 *
 * Fetches all deals/promotions from Awin, persists them to MongoDB,
 * removes expired deals, and removes deals no longer returned by Awin.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch all deals from Awin (no status filter to avoid API 400 errors)
    const { deals: allDeals } = await fetchDeals({ pageSize: 100 });

    // Persist to MongoDB
    const result = await upsertDeals(allDeals);

    // Remove expired deals (endDate has passed)
    const expired = await removeExpiredDeals();

    // Remove deals no longer in the Awin response
    const currentIds = allDeals.map((d) => d.id);
    const stale = await removeStaleDeals(currentIds);

    // Update sync metadata
    await updateSyncTime("deals", allDeals.length);

    console.log(
      `[cron/sync-deals] Synced ${allDeals.length} deals ` +
        `(${result.upserted} new, ${result.modified} updated, ` +
        `${expired} expired removed, ${stale} stale removed) ` +
        `at ${new Date().toISOString()}`,
    );

    return NextResponse.json({
      ok: true,
      syncedAt: new Date().toISOString(),
      count: allDeals.length,
      upserted: result.upserted,
      modified: result.modified,
      expiredRemoved: expired,
      staleRemoved: stale,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[cron/sync-deals] Sync failed:", error);
    await recordSyncError("deals", msg).catch(() => {});
    return NextResponse.json(
      { ok: false, error: "Sync failed." },
      { status: 500 },
    );
  }
}
