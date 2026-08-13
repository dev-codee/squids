import { NextRequest, NextResponse } from "next/server";
import { fetchTransactions } from "@/lib/transactions";
import { upsertTransactions } from "@/lib/db/transactions";
import {
  getLastSyncTime,
  updateSyncTime,
  recordSyncError,
} from "@/lib/db/sync-meta";

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
 * GET /api/cron/sync-transactions
 *
 * Incrementally syncs transactions from both Awin and Admitad to MongoDB.
 * Each network uses its own sync-meta key for incremental tracking.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};
  const endDate = new Date();

  // ── Awin ─────────────────────────────────────────────────────────────────
  try {
    const lastAwinSync =
      (await getLastSyncTime("awin:transactions")) ??
      (await getLastSyncTime("transactions"));
    let awinStartDate: Date;

    if (lastAwinSync) {
      awinStartDate = new Date(lastAwinSync.getTime() - 2 * 60 * 60 * 1000);
    } else {
      awinStartDate = new Date();
      awinStartDate.setUTCDate(awinStartDate.getUTCDate() - 31);
    }

    const awinTx = await fetchTransactions(
      awinStartDate.toISOString(),
      endDate.toISOString(),
    );
    const awinResult = await upsertTransactions(awinTx);
    await updateSyncTime("awin:transactions", awinTx.length);

    results.awin = {
      mode: lastAwinSync ? "incremental" : "full",
      count: awinTx.length,
      upserted: awinResult.upserted,
      modified: awinResult.modified,
      dateRange: {
        from: awinStartDate.toISOString(),
        to: endDate.toISOString(),
      },
    };

    console.log(
      `[cron/sync-transactions] Awin: ${awinTx.length} transactions ` +
        `(${awinResult.upserted} new, ${awinResult.modified} updated)`,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[cron/sync-transactions] Awin sync failed:", error);
    await recordSyncError("awin:transactions", msg).catch(() => {});
    results.awin = { error: msg };
  }

  // ── Admitad ──────────────────────────────────────────────────────────────
  try {
    const { fetchAdmitadActions } = await import("@/lib/admitad");

    const lastAdmitadSync = await getLastSyncTime("admitad:transactions");
    let admitadStartDate: Date;

    if (lastAdmitadSync) {
      admitadStartDate = new Date(lastAdmitadSync.getTime() - 2 * 60 * 60 * 1000);
    } else {
      admitadStartDate = new Date();
      admitadStartDate.setUTCDate(admitadStartDate.getUTCDate() - 31);
    }

    const admitadTx = await fetchAdmitadActions(
      admitadStartDate.toISOString(),
      endDate.toISOString(),
    );
    const admitadResult = await upsertTransactions(admitadTx);
    await updateSyncTime("admitad:transactions", admitadTx.length);

    results.admitad = {
      mode: lastAdmitadSync ? "incremental" : "full",
      count: admitadTx.length,
      upserted: admitadResult.upserted,
      modified: admitadResult.modified,
      dateRange: {
        from: admitadStartDate.toISOString(),
        to: endDate.toISOString(),
      },
    };

    console.log(
      `[cron/sync-transactions] Admitad: ${admitadTx.length} transactions ` +
        `(${admitadResult.upserted} new, ${admitadResult.modified} updated)`,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.warn("[cron/sync-transactions] Admitad sync failed (non-fatal):", msg);
    await recordSyncError("admitad:transactions", msg).catch(() => {});
    results.admitad = { error: msg };
  }

  return NextResponse.json({
    ok: true,
    syncedAt: new Date().toISOString(),
    results,
  });
}
