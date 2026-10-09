import { NextResponse } from "next/server";
import { getFeedHealthOverview, getRecentFeedFailures } from "@/lib/db/snapshots";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/feed-health
 *
 * Operator API returning sync status, freshness, last-good snapshot info,
 * and failure dead-letter queue.
 */
export async function GET() {
  try {
    const [overview, failures] = await Promise.all([
      getFeedHealthOverview(),
      getRecentFeedFailures(20),
    ]);

    return NextResponse.json({ overview, failures });
  } catch (error) {
    console.error("GET /api/admin/feed-health failed:", error);
    return NextResponse.json(
      { error: "Failed to load feed health overview." },
      { status: 500 },
    );
  }
}
