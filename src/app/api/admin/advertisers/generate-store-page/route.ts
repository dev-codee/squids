import { NextRequest, NextResponse } from "next/server";
import {
  getAdvertiserByIdFromDb,
  ensureAdvertiserStorePage,
} from "@/lib/db/advertisers";
import { getDealsFromDb } from "@/lib/db/deals";
import { getRegionConfig } from "@/lib/regions";
import { isAiConfigured } from "@/lib/ai/storeContent";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/advertisers/generate-store-page
 *
 * Generate (and cache) AI store-page content for one advertiser via Claude.
 * Body: { id, network?, country?, force? }. `force` regenerates existing content.
 * Protected by the admin session middleware.
 */
export async function POST(request: NextRequest) {
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI is not configured. Set ANTHROPIC_API_KEY on the server." },
      { status: 400 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    /* defaults */
  }

  const id = Number(body.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Valid advertiser id is required." }, { status: 400 });
  }
  const network = body.network ? String(body.network) : undefined;
  const force = Boolean(body.force);
  const region = getRegionConfig(body.country ? String(body.country) : "US");

  try {
    const advertiser = await getAdvertiserByIdFromDb(id, network);
    if (!advertiser) {
      return NextResponse.json({ error: "Advertiser not found." }, { status: 404 });
    }

    const dealsResult = await getDealsFromDb({
      advertiserId: id,
      status: "all",
      type: "all",
      page: 1,
      pageSize: 100,
      network,
    });

    const updated = await ensureAdvertiserStorePage(
      advertiser,
      dealsResult?.deals ?? [],
      { country: region.country, currency: region.currency },
      { force },
    );

    return NextResponse.json({
      ok: true,
      generated: Boolean(updated.aiStorePage),
      storePage: updated.aiStorePage ?? null,
    });
  } catch (error) {
    console.error("Error generating store page:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate store page." },
      { status: 500 },
    );
  }
}
