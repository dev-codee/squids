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
 * Fetches deals from both Awin and Admitad, persists them to MongoDB,
 * removes expired deals, and removes stale entries per network.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  // Remove expired deals across all networks first
  const expired = await removeExpiredDeals();

  // ── Awin ─────────────────────────────────────────────────────────────────
  try {
    const awinDeals: Deal[] = [];
    let page = 1;
    const pageSize = 100;

    while (page <= 10) {
      try {
        const { deals } = await fetchDeals({ page, pageSize });
        if (!deals || deals.length === 0) break;
        awinDeals.push(...deals);
        if (deals.length < pageSize) break;
        page++;
      } catch (pageErr) {
        console.warn(`[cron/sync-deals] Awin page ${page} error:`, pageErr);
        break;
      }
    }

    const awinResult = await upsertDeals(awinDeals);
    let awinStale = 0;
    if (awinDeals.length > 0) {
      awinStale = await removeStaleDeals(
        awinDeals.map((d) => d.id),
        "awin",
      );
    }
    await updateSyncTime("awin:deals", awinDeals.length);

    results.awin = {
      count: awinDeals.length,
      upserted: awinResult.upserted,
      modified: awinResult.modified,
      staleRemoved: awinStale,
    };

    console.log(
      `[cron/sync-deals] Awin: ${awinDeals.length} deals ` +
        `(${awinResult.upserted} new, ${awinResult.modified} updated, ${awinStale} stale removed)`,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[cron/sync-deals] Awin sync failed:", error);
    await recordSyncError("awin:deals", msg).catch(() => {});
    results.awin = { error: msg };
  }

  // ── Admitad ──────────────────────────────────────────────────────────────
  try {
    const { fetchAdmitadCoupons } = await import("@/lib/admitad");
    const admitadDeals = await fetchAdmitadCoupons();

    const admitadResult = await upsertDeals(admitadDeals);
    let admitadStale = 0;
    if (admitadDeals.length > 0) {
      admitadStale = await removeStaleDeals(
        admitadDeals.map((d) => d.id),
        "admitad",
      );
    }
    await updateSyncTime("admitad:deals", admitadDeals.length);

    results.admitad = {
      count: admitadDeals.length,
      upserted: admitadResult.upserted,
      modified: admitadResult.modified,
      staleRemoved: admitadStale,
    };

    console.log(
      `[cron/sync-deals] Admitad: ${admitadDeals.length} deals ` +
        `(${admitadResult.upserted} new, ${admitadResult.modified} updated, ${admitadStale} stale removed)`,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.warn("[cron/sync-deals] Admitad sync failed (non-fatal):", msg);
    await recordSyncError("admitad:deals", msg).catch(() => {});
    results.admitad = { error: msg };
  }

  // ── Commission Factory ───────────────────────────────────────────────────
  try {
    const { fetchCfCoupons } = await import("@/lib/commission-factory");
    const cfDeals = await fetchCfCoupons();

    const cfResult = await upsertDeals(cfDeals);
    let cfStale = 0;
    if (cfDeals.length > 0) {
      cfStale = await removeStaleDeals(
        cfDeals.map((d) => d.id),
        "commission-factory",
      );
    }
    await updateSyncTime("commission-factory:deals", cfDeals.length);

    results.cf = {
      count: cfDeals.length,
      upserted: cfResult.upserted,
      modified: cfResult.modified,
      staleRemoved: cfStale,
    };

    console.log(
      `[cron/sync-deals] CF: ${cfDeals.length} deals ` +
        `(${cfResult.upserted} new, ${cfResult.modified} updated, ${cfStale} stale removed)`,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.warn("[cron/sync-deals] CF sync failed (non-fatal):", msg);
    await recordSyncError("commission-factory:deals", msg).catch(() => {});
    results.cf = { error: msg };
  }

  // ── Kwanko ───────────────────────────────────────────────────────────────
  try {
    const { fetchKwankoPromotions } = await import("@/lib/kwanko");
    const kwankoDeals = await fetchKwankoPromotions();

    const kwankoResult = await upsertDeals(kwankoDeals);
    let kwankoStale = 0;
    if (kwankoDeals.length > 0) {
      kwankoStale = await removeStaleDeals(
        kwankoDeals.map((d) => d.id),
        "kwanko",
      );
    }
    await updateSyncTime("kwanko:deals", kwankoDeals.length);

    results.kwanko = {
      count: kwankoDeals.length,
      upserted: kwankoResult.upserted,
      modified: kwankoResult.modified,
      staleRemoved: kwankoStale,
    };

    console.log(
      `[cron/sync-deals] Kwanko: ${kwankoDeals.length} deals ` +
        `(${kwankoResult.upserted} new, ${kwankoResult.modified} updated, ${kwankoStale} stale removed)`,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.warn("[cron/sync-deals] Kwanko sync failed (non-fatal):", msg);
    await recordSyncError("kwanko:deals", msg).catch(() => {});
    results.kwanko = { error: msg };
  }

  return NextResponse.json({
    ok: true,
    syncedAt: new Date().toISOString(),
    expiredRemoved: expired,
    results,
  });
}
