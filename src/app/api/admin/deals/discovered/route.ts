import { NextRequest, NextResponse } from "next/server";
import {
  saveDiscoveredDeals,
  getDiscoveredDeals,
  getPendingDiscoveredCount,
  rejectDiscoveredDeal,
  type DiscoveredDealInput,
} from "@/lib/db/discovered-deals";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/deals/discovered
 * Query discovered deals for review, or get pending count.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const countOnly = searchParams.get("countOnly") === "true";

  try {
    if (countOnly) {
      const count = await getPendingDiscoveredCount();
      return NextResponse.json({ count });
    }

    const status = searchParams.get("status") || "pending";
    const advertiserIdRaw = searchParams.get("advertiserId");
    const advertiserId = advertiserIdRaw ? Number(advertiserIdRaw) : undefined;
    const page = Number(searchParams.get("page") || "1");
    const pageSize = Number(searchParams.get("pageSize") || "30");

    const result = await getDiscoveredDeals({
      status,
      advertiserId,
      page,
      pageSize,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[/api/admin/deals/discovered] GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load discovered deals." },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/deals/discovered
 * Ingestion endpoint called by n8n workflow or admin research runner.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    let rawCandidates: DiscoveredDealInput[] = [];
    let defaultAdvertiserId: number | undefined;

    if (Array.isArray(body)) {
      rawCandidates = body;
    } else if (Array.isArray(body.deals)) {
      rawCandidates = body.deals;
      defaultAdvertiserId = body.advertiserId ? Number(body.advertiserId) : undefined;
    } else if (Array.isArray(body.items)) {
      rawCandidates = body.items;
      defaultAdvertiserId = body.advertiserId ? Number(body.advertiserId) : undefined;
    } else if (body.title) {
      rawCandidates = [body];
      defaultAdvertiserId = body.advertiserId ? Number(body.advertiserId) : undefined;
    }

    if (rawCandidates.length === 0) {
      return NextResponse.json(
        { error: "No deals provided in request body." },
        { status: 400 },
      );
    }

    const result = await saveDiscoveredDeals(rawCandidates, defaultAdvertiserId);

    return NextResponse.json({
      ok: true,
      inserted: result.inserted,
      skippedExisting: result.skippedExisting,
      totalReceived: rawCandidates.length,
      items: result.items,
    });
  } catch (error) {
    console.error("[/api/admin/deals/discovered] POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save discovered deals." },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/deals/discovered?candidateId=xxx
 * Dismisses/rejects a discovered deal from staging.
 */
export async function DELETE(request: NextRequest) {
  try {
    const candidateId = request.nextUrl.searchParams.get("candidateId");
    if (!candidateId) {
      return NextResponse.json({ error: "candidateId is required" }, { status: 400 });
    }

    const success = await rejectDiscoveredDeal(candidateId);
    if (!success) {
      return NextResponse.json({ error: "Candidate deal not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[/api/admin/deals/discovered] DELETE error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reject deal." },
      { status: 500 },
    );
  }
}
