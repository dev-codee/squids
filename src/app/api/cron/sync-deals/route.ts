import { NextRequest, NextResponse } from "next/server";
import { fetchDeals, type Deal } from "@/lib/deals";
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
 * Fetches all pages of deals/promotions from Awin, persists them to MongoDB,
 * removes expired deals, and removes deals no longer returned by Awin.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const allDeals: Deal[] = [];
    let page = 1;
    const pageSize = 100;

    // Fetch all pages of deals from Awin
    while (page <= 10) { // Safety limit of 10 pages (1000 deals max)
      try {
        const { deals } = await fetchDeals({ page, pageSize });
        if (!deals || deals.length === 0) break;
        allDeals.push(...deals);
        if (deals.length < pageSize) break;
        page++;
      } catch (pageErr) {
        console.warn(`[cron/sync-deals] Error fetching page ${page}:`, pageErr);
        break;
      }
    }

    // Persist to MongoDB
    const result = await upsertDeals(allDeals);

    // Remove expired deals (endDate has passed)
    const expired = await removeExpiredDeals();

    // Remove deals no longer in the Awin response (only if we fetched successfully)
    let stale = 0;
    if (allDeals.length > 0) {
      const currentIds = allDeals.map((d) => d.id);
      stale = await removeStaleDeals(currentIds);
    }

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
