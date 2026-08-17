import { NextRequest, NextResponse } from "next/server";
import {
  createAdvertiser,
  updateAdvertiser,
  deleteAdvertiser,
  getNextAdvertiserId,
} from "@/lib/db/advertisers";
import type { Advertiser } from "@/lib/awin";
import { revalidatePublic, CACHE_TAGS } from "@/lib/cache";
import { logActivity } from "@/lib/db/activity-logs";

export const dynamic = "force-dynamic";

/** Advertiser changes affect store listings, store pages, and category counts. */
function invalidateAdvertiserCaches() {
  revalidatePublic(CACHE_TAGS.advertisers, CACHE_TAGS.categories);
}

/**
 * POST /api/admin/advertisers
 * Create a new advertiser in MongoDB.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: "Advertiser name is required." },
        { status: 400 },
      );
    }

    const id = body.id && !isNaN(Number(body.id))
      ? Number(body.id)
      : await getNextAdvertiserId();

    const advertiser: Advertiser = {
      id,
      network: body.network ? String(body.network).trim() : "awin",
      name: String(body.name).trim(),
      logoUrl: body.logoUrl ? String(body.logoUrl).trim() : null,
      status: body.status ? String(body.status).trim() : "active",
      relationship: body.relationship ? String(body.relationship).trim() : "joined",
      region: body.region ? String(body.region).trim() : null,
      countryCode: body.countryCode ? String(body.countryCode).trim().toUpperCase() : null,
      currencyCode: body.currencyCode ? String(body.currencyCode).trim().toUpperCase() : null,
      commission: body.commission ? String(body.commission).trim() : null,
      url: body.url ? String(body.url).trim() : null,
      description: body.description ? String(body.description).trim() : undefined,
      bannerUrl: body.bannerUrl ? String(body.bannerUrl).trim() : undefined,
      categories: Array.isArray(body.categories) ? body.categories : undefined,
      avgSavings: body.avgSavings ? String(body.avgSavings).trim() : undefined,
      rating: body.rating !== undefined ? Number(body.rating) : undefined,
      isFlagship: body.isFlagship === true,
      countryCodes: Array.isArray(body.countryCodes) ? body.countryCodes : [],
      isPPC: body.isPPC === true,
    };

    const created = await createAdvertiser(advertiser);
    invalidateAdvertiserCaches();

    await logActivity({
      type: "store_joined",
      title: `Store Joined: ${created.name}`,
      description: `New store ${created.name} (#${created.id}) added to ${created.network.toUpperCase()}.`,
      network: created.network,
      entity: "advertisers",
      status: "success",
    }).catch(() => {});

    return NextResponse.json({ ok: true, advertiser: created }, { status: 201 });
  } catch (error) {
    console.error("Error creating advertiser:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create advertiser." },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/admin/advertisers
 * Update an existing advertiser in MongoDB.
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id || isNaN(Number(body.id))) {
      return NextResponse.json(
        { error: "Valid advertiser ID is required." },
        { status: 400 },
      );
    }

    const id = Number(body.id);
    const updateData: Partial<Advertiser> = {};

    if (body.name !== undefined) updateData.name = String(body.name).trim();
    if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl ? String(body.logoUrl).trim() : null;
    if (body.status !== undefined) updateData.status = body.status ? String(body.status).trim() : null;
    if (body.relationship !== undefined) updateData.relationship = body.relationship ? String(body.relationship).trim() : null;
    if (body.region !== undefined) updateData.region = body.region ? String(body.region).trim() : null;
    if (body.countryCode !== undefined) updateData.countryCode = body.countryCode ? String(body.countryCode).trim().toUpperCase() : null;
    if (body.currencyCode !== undefined) updateData.currencyCode = body.currencyCode ? String(body.currencyCode).trim().toUpperCase() : null;
    if (body.commission !== undefined) updateData.commission = body.commission ? String(body.commission).trim() : null;
    if (body.url !== undefined) updateData.url = body.url ? String(body.url).trim() : null;
    if (body.description !== undefined) updateData.description = body.description ? String(body.description).trim() : undefined;
    if (body.bannerUrl !== undefined) updateData.bannerUrl = body.bannerUrl ? String(body.bannerUrl).trim() : undefined;
    if (body.categories !== undefined) updateData.categories = Array.isArray(body.categories) ? body.categories : undefined;
    if (body.avgSavings !== undefined) updateData.avgSavings = body.avgSavings ? String(body.avgSavings).trim() : undefined;
    if (body.rating !== undefined) updateData.rating = body.rating !== null ? Number(body.rating) : undefined;
    if (body.isFlagship !== undefined) updateData.isFlagship = Boolean(body.isFlagship);
    if (body.countryCodes !== undefined) updateData.countryCodes = Array.isArray(body.countryCodes) ? body.countryCodes : [];
    if (body.isPPC !== undefined) updateData.isPPC = Boolean(body.isPPC);
    // AI store-page content — accept an object (edited copy) or null (clear it).
    if (body.aiStorePage !== undefined) {
      updateData.aiStorePage =
        body.aiStorePage && typeof body.aiStorePage === "object" ? body.aiStorePage : null;
      updateData.aiStorePageAt = new Date().toISOString();
    }

    const network = body.network ? String(body.network).trim() : "awin";
    const success = await updateAdvertiser(id, updateData, network);
    if (!success) {
      return NextResponse.json(
        { error: `Advertiser with ID ${id} not found.` },
        { status: 404 },
      );
    }

    invalidateAdvertiserCaches();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating advertiser:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update advertiser." },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/advertisers?id=123
 * Delete an advertiser from MongoDB.
 */
export async function DELETE(request: NextRequest) {
  try {
    const idRaw = request.nextUrl.searchParams.get("id");
    if (!idRaw || isNaN(Number(idRaw))) {
      return NextResponse.json(
        { error: "Valid advertiser ID query parameter is required." },
        { status: 400 },
      );
    }

    const id = Number(idRaw);
    const network = request.nextUrl.searchParams.get("network")?.trim() || "awin";
    const success = await deleteAdvertiser(id, network);

    if (!success) {
      return NextResponse.json(
        { error: `Advertiser with ID ${id} not found.` },
        { status: 404 },
      );
    }

    invalidateAdvertiserCaches();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting advertiser:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete advertiser." },
      { status: 500 },
    );
  }
}
