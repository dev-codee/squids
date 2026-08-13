import { NextRequest, NextResponse } from "next/server";
import {
  createDeal,
  updateDeal,
  deleteDeal,
  getNextDealId,
} from "@/lib/db/deals";
import type { Deal, CouponSubtype, DealPlacement } from "@/lib/deals";

export const dynamic = "force-dynamic";

const COUPON_SUBTYPES: CouponSubtype[] = ["code", "student", "cashback"];
const DEAL_PLACEMENTS: DealPlacement[] = ["todays", "lightning", "limited", "trending"];

/** Parse a value into a finite number, or null. */
function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toTrimmedOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

/**
 * Pull the optional admin-managed enrichment fields off a request body.
 * Only keys present on `body` are returned, so this is safe for PATCH-style updates.
 */
function parseEnrichment(body: Record<string, unknown>): Partial<Deal> {
  const out: Partial<Deal> = {};

  if ("discountText" in body) out.discountText = toTrimmedOrNull(body.discountText);
  if ("imageUrl" in body) out.imageUrl = toTrimmedOrNull(body.imageUrl);
  if ("originalPrice" in body) out.originalPrice = toNumberOrNull(body.originalPrice);
  if ("salePrice" in body) out.salePrice = toNumberOrNull(body.salePrice);
  if ("isExclusive" in body) out.isExclusive = Boolean(body.isExclusive);
  if ("cashbackRate" in body) out.cashbackRate = toTrimmedOrNull(body.cashbackRate);
  if ("studentVerificationReq" in body) {
    out.studentVerificationReq = toTrimmedOrNull(body.studentVerificationReq);
  }
  if ("stockPercentage" in body) {
    const n = toNumberOrNull(body.stockPercentage);
    out.stockPercentage = n === null ? null : Math.max(0, Math.min(100, n));
  }
  if ("subtype" in body) {
    const s = toTrimmedOrNull(body.subtype);
    out.subtype = s && COUPON_SUBTYPES.includes(s as CouponSubtype) ? (s as CouponSubtype) : null;
  }
  if ("placement" in body) {
    const p = toTrimmedOrNull(body.placement);
    out.placement = p && DEAL_PLACEMENTS.includes(p as DealPlacement) ? (p as DealPlacement) : null;
  }

  return out;
}

/**
 * POST /api/admin/deals
 * Create a new deal/promotion in MongoDB.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.title) {
      return NextResponse.json(
        { error: "Deal title is required." },
        { status: 400 },
      );
    }
    if (!body.advertiser?.id || !body.advertiser?.name) {
      return NextResponse.json(
        { error: "Advertiser ID and name are required." },
        { status: 400 },
      );
    }

    const id = body.id && !isNaN(Number(body.id))
      ? Number(body.id)
      : await getNextDealId();

    const regionCodes = Array.isArray(body.regionCodes)
      ? body.regionCodes.map((r: string) => String(r).trim().toUpperCase())
      : typeof body.regionCodes === "string" && body.regionCodes.trim()
      ? body.regionCodes.split(",").map((r: string) => r.trim().toUpperCase())
      : [];

    const deal: Deal = {
      id,
      network: body.network ? String(body.network).trim() : "awin",
      title: String(body.title).trim(),
      description: body.description ? String(body.description).trim() : null,
      advertiser: {
        id: Number(body.advertiser.id),
        name: String(body.advertiser.name).trim(),
        logoUrl: body.advertiser.logoUrl ? String(body.advertiser.logoUrl).trim() : null,
      },
      type: body.type === "voucher" ? "voucher" : "promotion",
      code: body.code ? String(body.code).trim() : null,
      startDate: body.startDate ? String(body.startDate).trim() : null,
      endDate: body.endDate ? String(body.endDate).trim() : null,
      status: body.status ? String(body.status).trim() : "active",
      trackingUrl: body.trackingUrl ? String(body.trackingUrl).trim() : null,
      regionCodes,
      ...parseEnrichment(body),
    };

    const created = await createDeal(deal);
    return NextResponse.json({ ok: true, deal: created }, { status: 201 });
  } catch (error) {
    console.error("Error creating deal:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create deal." },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/admin/deals
 * Update an existing deal in MongoDB.
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id || isNaN(Number(body.id))) {
      return NextResponse.json(
        { error: "Valid deal ID is required." },
        { status: 400 },
      );
    }

    const id = Number(body.id);
    const updateData: Partial<Deal> = {};

    if (body.title !== undefined) updateData.title = String(body.title).trim();
    if (body.description !== undefined) updateData.description = body.description ? String(body.description).trim() : null;
    if (body.type !== undefined) updateData.type = body.type === "voucher" ? "voucher" : "promotion";
    if (body.code !== undefined) updateData.code = body.code ? String(body.code).trim() : null;
    if (body.startDate !== undefined) updateData.startDate = body.startDate ? String(body.startDate).trim() : null;
    if (body.endDate !== undefined) updateData.endDate = body.endDate ? String(body.endDate).trim() : null;
    if (body.status !== undefined) updateData.status = body.status ? String(body.status).trim() : "active";
    if (body.trackingUrl !== undefined) updateData.trackingUrl = body.trackingUrl ? String(body.trackingUrl).trim() : null;

    if (body.advertiser) {
      updateData.advertiser = {
        id: Number(body.advertiser.id),
        name: String(body.advertiser.name).trim(),
        logoUrl: body.advertiser.logoUrl ? String(body.advertiser.logoUrl).trim() : null,
      };
    }

    if (body.regionCodes !== undefined) {
      updateData.regionCodes = Array.isArray(body.regionCodes)
        ? body.regionCodes.map((r: string) => String(r).trim().toUpperCase())
        : typeof body.regionCodes === "string" && body.regionCodes.trim()
        ? body.regionCodes.split(",").map((r: string) => r.trim().toUpperCase())
        : [];
    }

    Object.assign(updateData, parseEnrichment(body));

    const success = await updateDeal(id, updateData);
    if (!success) {
      return NextResponse.json(
        { error: `Deal with ID ${id} not found.` },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating deal:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update deal." },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/deals?id=123
 * Delete a deal from MongoDB.
 */
export async function DELETE(request: NextRequest) {
  try {
    const idRaw = request.nextUrl.searchParams.get("id");
    if (!idRaw || isNaN(Number(idRaw))) {
      return NextResponse.json(
        { error: "Valid deal ID query parameter is required." },
        { status: 400 },
      );
    }

    const id = Number(idRaw);
    const success = await deleteDeal(id);

    if (!success) {
      return NextResponse.json(
        { error: `Deal with ID ${id} not found.` },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting deal:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete deal." },
      { status: 500 },
    );
  }
}
