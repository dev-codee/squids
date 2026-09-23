import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

/**
 * One-off backfill: sets `firstSeenAt` on deals that predate the field
 * (added for follow-store alerts, see src/lib/db/deals.ts). Uses `syncedAt` as
 * the best available stand-in so existing deals aren't mistaken for brand-new
 * ones the first time the alert cron runs. Idempotent — a no-op once done.
 */
export async function GET() {
  try {
    const db = await getDb();
    const col = db.collection("deals");

    const result = await col.updateMany(
      { firstSeenAt: { $exists: false } },
      [{ $set: { firstSeenAt: { $ifNull: ["$syncedAt", "$$NOW"] } } }],
    );

    return NextResponse.json({
      success: true,
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 },
    );
  }
}
