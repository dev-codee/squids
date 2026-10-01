import { NextRequest, NextResponse } from "next/server";
import { approveDiscoveredDeal } from "@/lib/db/discovered-deals";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/deals/discovered/approve
 * Approves a candidate deal and saves it into the live `deals` collection.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const candidateId = body.candidateId;

    if (!candidateId) {
      return NextResponse.json(
        { error: "candidateId is required." },
        { status: 400 },
      );
    }

    const overrides = body.overrides || {};
    const result = await approveDiscoveredDeal(candidateId, overrides);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Failed to approve deal." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      deal: result.deal,
      message: "Deal successfully approved and published to live store!",
    });
  } catch (error) {
    console.error("[/api/admin/deals/discovered/approve] POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error approving deal." },
      { status: 500 },
    );
  }
}
