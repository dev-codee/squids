import { NextResponse } from "next/server";
import { getProductAlertOperationsMetrics } from "@/lib/db/product-alerts";
import { getDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/alerts
 *
 * Returns alert metrics and recent product alert requests.
 */
export async function GET() {
  try {
    const db = await getDb();
    const productAlertsCol = db.collection("product_alerts");
    const storeSubscribersCol = db.collection("subscribers");

    const [metrics, recentAlerts, recentSubscribers] = await Promise.all([
      getProductAlertOperationsMetrics(),
      productAlertsCol.find({}).sort({ createdAt: -1 }).limit(25).toArray(),
      storeSubscribersCol.find({}).sort({ createdAt: -1 }).limit(25).toArray(),
    ]);

    return NextResponse.json({
      metrics,
      recentAlerts,
      recentSubscribers,
    });
  } catch (error) {
    console.error("GET /api/admin/alerts failed:", error);
    return NextResponse.json(
      { error: "Failed to load alert operations." },
      { status: 500 },
    );
  }
}
