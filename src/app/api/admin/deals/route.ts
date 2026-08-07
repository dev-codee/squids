import { NextRequest, NextResponse } from "next/server";
import {
  createDeal,
  updateDeal,
  deleteDeal,
  getNextDealId,
} from "@/lib/db/deals";
import type { Deal } from "@/lib/deals";

export const dynamic = "force-dynamic";

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
