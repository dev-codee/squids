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

  // ── Commission Factory ───────────────────────────────────────────────────
  try {
    const { fetchCfTransactions } = await import("@/lib/commission-factory");

    const lastCfSync = await getLastSyncTime("commission-factory:transactions");
    let cfStartDate: Date;

    if (lastCfSync) {
      cfStartDate = new Date(lastCfSync.getTime() - 2 * 60 * 60 * 1000);
    } else {
      cfStartDate = new Date();
      cfStartDate.setUTCDate(cfStartDate.getUTCDate() - 31);
    }

    const cfTx = await fetchCfTransactions(
      cfStartDate.toISOString(),
      endDate.toISOString(),
    );
    const cfResult = await upsertTransactions(cfTx);
    await updateSyncTime("commission-factory:transactions", cfTx.length);

    results.cf = {
      mode: lastCfSync ? "incremental" : "full",
      count: cfTx.length,
      upserted: cfResult.upserted,
      modified: cfResult.modified,
      dateRange: {
        from: cfStartDate.toISOString(),
        to: endDate.toISOString(),
      },
    };

    console.log(
      `[cron/sync-transactions] CF: ${cfTx.length} transactions ` +
        `(${cfResult.upserted} new, ${cfResult.modified} updated)`,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.warn("[cron/sync-transactions] CF sync failed (non-fatal):", msg);
    await recordSyncError("commission-factory:transactions", msg).catch(() => {});
    results.cf = { error: msg };
  }

  // ── Kwanko ───────────────────────────────────────────────────────────────
  try {
    const { fetchKwankoConversions } = await import("@/lib/kwanko");

    const lastKwankoSync = await getLastSyncTime("kwanko:transactions");
    let kwankoStartDate: Date;

    if (lastKwankoSync) {
      kwankoStartDate = new Date(lastKwankoSync.getTime() - 2 * 60 * 60 * 1000);
    } else {
      kwankoStartDate = new Date();
      kwankoStartDate.setUTCDate(kwankoStartDate.getUTCDate() - 31);
    }

    const kwankoTx = await fetchKwankoConversions(
      kwankoStartDate.toISOString(),
      endDate.toISOString(),
    );
    const kwankoResult = await upsertTransactions(kwankoTx);
    await updateSyncTime("kwanko:transactions", kwankoTx.length);

    results.kwanko = {
      mode: lastKwankoSync ? "incremental" : "full",
      count: kwankoTx.length,
      upserted: kwankoResult.upserted,
      modified: kwankoResult.modified,
      dateRange: {
        from: kwankoStartDate.toISOString(),
        to: endDate.toISOString(),
      },
    };

    console.log(
      `[cron/sync-transactions] Kwanko: ${kwankoTx.length} transactions ` +
        `(${kwankoResult.upserted} new, ${kwankoResult.modified} updated)`,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.warn("[cron/sync-transactions] Kwanko sync failed (non-fatal):", msg);
    await recordSyncError("kwanko:transactions", msg).catch(() => {});
    results.kwanko = { error: msg };
  }

  return NextResponse.json({
    ok: true,
    syncedAt: new Date().toISOString(),
    results,
  });
}
