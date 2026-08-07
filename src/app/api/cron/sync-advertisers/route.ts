import { NextRequest, NextResponse } from "next/server";
import { fetchProgrammes } from "@/lib/awin";
import { upsertAdvertisers, removeStaleAdvertisers } from "@/lib/db/advertisers";
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
 * GET /api/cron/sync-advertisers
 *
 * Fetches joined + pending advertisers from Awin, persists them to MongoDB,
 * and removes any advertisers that are no longer in the Awin response.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch both joined and pending advertisers
    const [joined, pending] = await Promise.all([
      fetchProgrammes("joined").catch((err) => {
        console.warn("[cron/sync-advertisers] Failed to fetch joined:", err);
        return [];
      }),
      fetchProgrammes("pending").catch((err) => {
        console.warn("[cron/sync-advertisers] Failed to fetch pending:", err);
        return [];
      }),
    ]);

    // Merge, de-duplicating by id (joined wins)
    const byId = new Map<number, (typeof joined)[0]>();
    for (const a of [...joined, ...pending]) {
      if (!byId.has(a.id)) byId.set(a.id, a);
    }
    const allAdvertisers = Array.from(byId.values());

    // Persist to MongoDB
    const result = await upsertAdvertisers(allAdvertisers);

    // Remove advertisers no longer in the Awin response
    const currentIds = allAdvertisers.map((a) => a.id);
    const removed = await removeStaleAdvertisers(currentIds);

    // Update sync metadata
    await updateSyncTime("advertisers", allAdvertisers.length);

    console.log(
      `[cron/sync-advertisers] Synced ${allAdvertisers.length} advertisers ` +
        `(${result.upserted} new, ${result.modified} updated, ${removed} removed) ` +
        `at ${new Date().toISOString()}`,
    );

    return NextResponse.json({
      ok: true,
      syncedAt: new Date().toISOString(),
      count: allAdvertisers.length,
      upserted: result.upserted,
      modified: result.modified,
      removed,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[cron/sync-advertisers] Sync failed:", error);
    await recordSyncError("advertisers", msg).catch(() => {});
    return NextResponse.json(
      { ok: false, error: "Sync failed." },
      { status: 500 },
    );
  }
}
