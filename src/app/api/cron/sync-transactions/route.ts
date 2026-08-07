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
 * Incrementally syncs transactions from Awin to MongoDB.
 *
 * - First run (no sync metadata): fetches the last 31 days.
 * - Subsequent runs: fetches only since the last successful sync, with a
 *   2-hour overlap to catch any late-arriving transactions.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const endDate = new Date();

    // Determine start date: use last sync time or fall back to 31 days ago
    const lastSync = await getLastSyncTime("transactions");
    let startDate: Date;

    if (lastSync) {
      // Fetch from 2 hours before the last sync to catch any late arrivals
      startDate = new Date(lastSync.getTime() - 2 * 60 * 60 * 1000);
    } else {
      // First run — fetch the full 31 days
      startDate = new Date();
      startDate.setUTCDate(startDate.getUTCDate() - 31);
    }

    const transactions = await fetchTransactions(
      startDate.toISOString(),
      endDate.toISOString(),
    );

    // Persist to MongoDB (upsert handles deduplication by id)
    const result = await upsertTransactions(transactions);

    // Update sync metadata
    await updateSyncTime("transactions", transactions.length);

    const isIncremental = !!lastSync;

    console.log(
      `[cron/sync-transactions] ${isIncremental ? "Incremental" : "Full"} sync: ` +
        `${transactions.length} transactions ` +
        `(${result.upserted} new, ${result.modified} updated) ` +
        `at ${new Date().toISOString()}`,
    );

    return NextResponse.json({
      ok: true,
      syncedAt: new Date().toISOString(),
      mode: isIncremental ? "incremental" : "full",
      count: transactions.length,
      upserted: result.upserted,
      modified: result.modified,
      dateRange: {
        from: startDate.toISOString(),
        to: endDate.toISOString(),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[cron/sync-transactions] Sync failed:", error);
    await recordSyncError("transactions", msg).catch(() => {});
    return NextResponse.json(
      { ok: false, error: "Sync failed." },
      { status: 500 },
    );
  }
}
