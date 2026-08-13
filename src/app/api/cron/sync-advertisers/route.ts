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
 * Fetches advertisers from both Awin and Admitad, persists them to MongoDB,
 * and removes stale entries per network.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  // ── Awin ─────────────────────────────────────────────────────────────────
  try {
    const [joined, pending] = await Promise.all([
      fetchProgrammes("joined").catch((err) => {
        console.warn("[cron/sync-advertisers] Failed to fetch Awin joined:", err);
        return [];
      }),
      fetchProgrammes("pending").catch((err) => {
        console.warn("[cron/sync-advertisers] Failed to fetch Awin pending:", err);
        return [];
      }),
    ]);

    const byId = new Map<number, (typeof joined)[0]>();
    for (const a of [...joined, ...pending]) {
      if (!byId.has(a.id)) byId.set(a.id, a);
    }
    const awinAdvertisers = Array.from(byId.values());

    const awinResult = await upsertAdvertisers(awinAdvertisers);
    const awinRemoved = await removeStaleAdvertisers(
      awinAdvertisers.map((a) => a.id),
      "awin",
    );
    await updateSyncTime("awin:advertisers", awinAdvertisers.length);

    results.awin = {
      count: awinAdvertisers.length,
      upserted: awinResult.upserted,
      modified: awinResult.modified,
      removed: awinRemoved,
    };

    console.log(
      `[cron/sync-advertisers] Awin: ${awinAdvertisers.length} advertisers ` +
        `(${awinResult.upserted} new, ${awinResult.modified} updated, ${awinRemoved} removed)`,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[cron/sync-advertisers] Awin sync failed:", error);
    await recordSyncError("awin:advertisers", msg).catch(() => {});
    results.awin = { error: msg };
  }

  // ── Admitad ──────────────────────────────────────────────────────────────
  try {
    const { fetchAdmitadCampaigns } = await import("@/lib/admitad");
    const admitadAdvertisers = await fetchAdmitadCampaigns();

    const admitadResult = await upsertAdvertisers(admitadAdvertisers);
    const admitadRemoved = await removeStaleAdvertisers(
      admitadAdvertisers.map((a) => a.id),
      "admitad",
    );
    await updateSyncTime("admitad:advertisers", admitadAdvertisers.length);

    results.admitad = {
      count: admitadAdvertisers.length,
      upserted: admitadResult.upserted,
      modified: admitadResult.modified,
      removed: admitadRemoved,
    };

    console.log(
      `[cron/sync-advertisers] Admitad: ${admitadAdvertisers.length} advertisers ` +
        `(${admitadResult.upserted} new, ${admitadResult.modified} updated, ${admitadRemoved} removed)`,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.warn("[cron/sync-advertisers] Admitad sync failed (non-fatal):", msg);
    await recordSyncError("admitad:advertisers", msg).catch(() => {});
    results.admitad = { error: msg };
  }

  // ── Commission Factory ───────────────────────────────────────────────────
  try {
    const { fetchCfMerchants } = await import("@/lib/commission-factory");
    const cfAdvertisers = await fetchCfMerchants();

    const cfResult = await upsertAdvertisers(cfAdvertisers);
    const cfRemoved = await removeStaleAdvertisers(
      cfAdvertisers.map((a) => a.id),
      "commission-factory",
    );
    await updateSyncTime("commission-factory:advertisers", cfAdvertisers.length);

    results.cf = {
      count: cfAdvertisers.length,
      upserted: cfResult.upserted,
      modified: cfResult.modified,
      removed: cfRemoved,
    };

    console.log(
      `[cron/sync-advertisers] CF: ${cfAdvertisers.length} advertisers ` +
        `(${cfResult.upserted} new, ${cfResult.modified} updated, ${cfRemoved} removed)`,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.warn("[cron/sync-advertisers] CF sync failed (non-fatal):", msg);
    await recordSyncError("commission-factory:advertisers", msg).catch(() => {});
    results.cf = { error: msg };
  }

  return NextResponse.json({
    ok: true,
    syncedAt: new Date().toISOString(),
    results,
  });
}
