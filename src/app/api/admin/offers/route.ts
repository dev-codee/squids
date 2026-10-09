import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import {
  quarantineOffer,
  recordOfferCheck,
  publishOffer,
  countOffersByStatus,
} from "@/lib/db/offers";
import { getDeliveryRuleFor } from "@/lib/db/delivery";
import { deliveredTotal } from "@/lib/model/deliveredTotal";
import { known } from "@/lib/model/known";
import type { MerchantMarketId } from "@/lib/model/merchantMarket";
import type { RetailerOfferRecord } from "@/lib/model/offer";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/offers?status=draft|current|stale|quarantined&merchantMarketId=...
 */
export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status") || "all";
  const merchantMarketId = request.nextUrl.searchParams.get("merchantMarketId");
  const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("limit") || 50)));

  try {
    const db = await getDb();
    const col = db.collection<RetailerOfferRecord>("offers");

    const filter: Record<string, unknown> = {};
    if (status !== "all") filter.status = status;
    if (merchantMarketId) filter.merchantMarketId = merchantMarketId;

    const [offers, counts] = await Promise.all([
      col.find(filter).sort({ updatedAt: -1 }).limit(limit).toArray(),
      countOffersByStatus(),
    ]);

    return NextResponse.json({
      offers,
      counts,
    });
  } catch (error) {
    console.error("GET /api/admin/offers failed:", error);
    return NextResponse.json({ error: "Failed to load offers." }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/offers
 * Body: { id, action: "publish" | "quarantine" | "check", reason?: string, reviewer?: string }
 */
export async function PATCH(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = typeof body?.id === "string" ? body.id : "";
  const action = body?.action;
  const reason = typeof body?.reason === "string" ? body.reason : "Manual operator action";

  if (!id) {
    return NextResponse.json({ error: "Offer id is required" }, { status: 400 });
  }

  try {
    let success = false;
    if (action === "publish") {
      success = await publishOffer(id);
    } else if (action === "quarantine") {
      success = await quarantineOffer(id, reason);
    } else if (action === "check") {
      success = await recordOfferCheck(id);
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ ok: success });
  } catch (error) {
    console.error("PATCH /api/admin/offers failed:", error);
    return NextResponse.json({ error: "Failed to update offer." }, { status: 500 });
  }
}

/**
 * POST /api/admin/offers/preview-calculation
 * Body: { merchantMarketId, itemPrice, destination: { market, postcode } }
 */
export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const merchantMarketId = body?.merchantMarketId as MerchantMarketId;
  const itemPrice = Number(body?.itemPrice);
  const destination = body?.destination || { market: "US" };

  if (!merchantMarketId || !Number.isFinite(itemPrice)) {
    return NextResponse.json(
      { error: "merchantMarketId and itemPrice are required" },
      { status: 400 },
    );
  }

  try {
    const deliveryRule = await getDeliveryRuleFor(merchantMarketId, destination);
    const breakdown = deliveredTotal({
      itemPrice: known(itemPrice),
      currency: "USD",
      deliveryRule,
      shopper: {
        market: destination.market || "US",
        postcode: destination.postcode,
        quantity: 1,
      },
    });

    return NextResponse.json({
      breakdown,
      deliveryRuleFound: Boolean(deliveryRule),
    });
  } catch (error) {
    console.error("Calculation preview error:", error);
    return NextResponse.json({ error: "Calculation failed" }, { status: 500 });
  }
}
