import { NextRequest, NextResponse } from "next/server";
import { getActivityLogs, getActivitySummary } from "@/lib/db/activity-logs";
import { getAllSyncStatus } from "@/lib/db/sync-meta";
import { getDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/activity-logs
 *
 * Returns activity log feed, cron sync health matrix, summary stats,
 * and recently joined stores / recently added deals.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const query = {
    page: Number.parseInt(params.get("page") ?? "1", 10) || 1,
    pageSize: Number.parseInt(params.get("pageSize") ?? "20", 10) || 20,
    type: params.get("type") ?? "all",
    network: params.get("network") ?? "all",
    status: params.get("status") ?? "all",
    search: params.get("search") ?? "",
  };

  try {
    const db = await getDb();

    const [
      logData,
      summary,
      syncStatusRaw,
      recentStoresDocs,
      recentDealsDocs,
    ] = await Promise.all([
      getActivityLogs(query),
      getActivitySummary(),
      getAllSyncStatus(),
      db.collection("advertisers")
        .find({})
        .sort({ syncedAt: -1 })
        .limit(15)
        .project({ _id: 0, id: 1, name: 1, network: 1, logoUrl: 1, relationship: 1, region: 1, countryCode: 1, syncedAt: 1, dealCount: 1 })
        .toArray(),
      db.collection("deals")
        .find({})
        .sort({ syncedAt: -1 })
        .limit(15)
        .project({ _id: 0, id: 1, title: 1, network: 1, code: 1, discountText: 1, type: 1, status: 1, syncedAt: 1, advertiser: 1 })
        .toArray(),
    ]);

    // Format sync status entries
    const syncStatus = syncStatusRaw.map((s) => ({
      entity: s.entity,
      lastSyncedAt: s.lastSyncedAt,
      lastCount: s.lastCount,
      status: s.status,
      errorMessage: s.errorMessage,
    }));

    return NextResponse.json({
      logs: logData.items,
      total: logData.total,
      page: logData.page,
      pageSize: logData.pageSize,
      totalPages: logData.totalPages,
      summary,
      syncStatus,
      recentStores: recentStoresDocs,
      recentDeals: recentDealsDocs,
    });
  } catch (error) {
    console.error("[api/admin/activity-logs] Error fetching logs:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load activity logs." },
      { status: 500 },
    );
  }
}
