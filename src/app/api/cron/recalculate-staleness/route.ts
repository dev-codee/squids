import { NextRequest, NextResponse } from "next/server";
import { refreshStaleness } from "@/lib/db/offers";
import { removeExpiredDeals } from "@/lib/db/deals";
import { recountCategoryStats } from "@/lib/db/categories";
import { revalidatePublic, CACHE_TAGS } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function isAuthorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const querySecret = request.nextUrl.searchParams.get("secret");
  return querySecret === secret;
}

/**
 * GET /api/cron/recalculate-staleness
 *
 * Runs scheduled staleness sweeps:
 * 1. Flips offers older than max age (48h) to stale
 * 2. Prunes deals past their end date
 * 3. Recalculates category active store and deal counts
 * 4. Invalidates cached public tags
 */
export async function GET(request: NextRequest) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [stalenessResult, expiredDealsRemoved] = await Promise.all([
      refreshStaleness(48),
      removeExpiredDeals().catch(() => 0),
    ]);

    await recountCategoryStats().catch(() => undefined);

    // Invalidate public page caches so expired counts and offers update immediately
    revalidatePublic(CACHE_TAGS.deals);
    revalidatePublic(CACHE_TAGS.categories);
    revalidatePublic(CACHE_TAGS.advertisers);

    return NextResponse.json({
      success: true,
      markedStale: stalenessResult.markedStale,
      markedCurrent: stalenessResult.markedCurrent,
      expiredDealsRemoved,
      revalidatedTags: [CACHE_TAGS.deals, CACHE_TAGS.categories, CACHE_TAGS.advertisers],
    });
  } catch (error) {
    console.error("[cron/recalculate-staleness] Sweep failed:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 },
    );
  }
}
