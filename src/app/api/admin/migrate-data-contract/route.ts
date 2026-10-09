import { NextRequest, NextResponse } from "next/server";
import { runDataContractBackfill } from "@/lib/migrations/backfill-data-contract";
import { logActivity } from "@/lib/db/activity-logs";

export const dynamic = "force-dynamic";
// The backfill walks every advertiser, product and deal.
export const maxDuration = 300;

/**
 * POST /api/admin/migrate-data-contract
 *
 * Phase B backfill: derive merchant-markets, retailer offers and structured
 * promotions from the existing collections.
 *
 * Session-protected by middleware (`/api/admin/*`). Safe to re-run — every
 * write is an idempotent upsert on a stable ID, and operator-owned fields are
 * only written on insert.
 *
 * Body (optional): { dryRun?: boolean }
 * A dry run reports what *would* be written and touches nothing.
 *
 * Advertisers that name no configured market are skipped rather than parked in
 * a default one, and slug collisions are withheld for an operator to merge.
 */
export async function POST(request: NextRequest) {
  let dryRun = false;

  try {
    const body = await request.json();
    dryRun = Boolean(body?.dryRun);
  } catch {
    // No body is fine — defaults apply.
  }

  try {
    const report = await runDataContractBackfill({ dryRun });

    if (!dryRun) {
      await logActivity({
        type: "system",
        title: "Data contract backfill",
        description:
          `merchant_markets +${report.merchantMarkets.upserted}/~${report.merchantMarkets.modified}, ` +
          `offers +${report.offers.upserted}/~${report.offers.modified}, ` +
          `promotions ${report.promotions.structured} structured. ` +
          `Nothing published: merchant-markets are pending, offers are draft.`,
        entity: "data-contract",
        stats: {
          created: report.merchantMarkets.upserted + report.offers.upserted,
          updated: report.merchantMarkets.modified + report.offers.modified,
          total: report.merchantMarkets.scanned + report.offers.scanned,
        },
        status: report.warnings.length > 0 ? "warning" : "success",
        metadata: { warningCount: report.warnings.length },
      }).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      report,
      // Say plainly that this published nothing, so nobody assumes it did.
      note: dryRun
        ? "Dry run — nothing was written."
        : "Merchant-markets are 'pending' with no permissions and offers are 'draft'. Grant rights and publish deliberately before any page or campaign uses them.",
    });
  } catch (error) {
    console.error("[migrate-data-contract] failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Migration failed." },
      { status: 500 },
    );
  }
}
