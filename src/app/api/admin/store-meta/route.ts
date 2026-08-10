import { NextRequest, NextResponse } from "next/server";
import {
  createStoreMeta,
  updateStoreMeta,
  deleteStoreMeta,
  getNextStoreMetaId,
} from "@/lib/db/storeMeta";
import type { StoreMeta } from "@/lib/storeMeta";

export const dynamic = "force-dynamic";

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const advertiserId = toNumberOrNull(body.advertiserId);
    if (!advertiserId) {
      return NextResponse.json(
        { error: "Advertiser ID is required." },
        { status: 400 },
      );
    }

    const id = body.id && !isNaN(Number(body.id))
      ? Number(body.id)
      : await getNextStoreMetaId();

    const categories = Array.isArray(body.categories)
      ? body.categories.map((c: string) => String(c).trim()).filter(Boolean)
      : typeof body.categories === "string" && body.categories.trim()
      ? body.categories.split(",").map((c: string) => c.trim()).filter(Boolean)
      : [];

    const storeMeta: StoreMeta = {
      id,
      advertiserId,
      slug: toTrimmedOrNull(body.slug),
      rating: toNumberOrNull(body.rating) ?? 0,
      categories,
      bannerUrl: toTrimmedOrNull(body.bannerUrl),
      description: toTrimmedOrNull(body.description),
      avgSavings: toTrimmedOrNull(body.avgSavings),
    };

    const created = await createStoreMeta(storeMeta);
    return NextResponse.json({ ok: true, storeMeta: created }, { status: 201 });
  } catch (error) {
    console.error("Error creating store meta:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create store meta." },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const id = toNumberOrNull(body.id);
    if (!id) {
      return NextResponse.json(
        { error: "Valid Store Meta ID is required." },
        { status: 400 },
      );
    }

    const updateData: Partial<StoreMeta> = {};

    if (body.advertiserId !== undefined) {
      const advId = toNumberOrNull(body.advertiserId);
      if (advId) updateData.advertiserId = advId;
    }
    if (body.slug !== undefined) updateData.slug = toTrimmedOrNull(body.slug);
    if (body.rating !== undefined) updateData.rating = toNumberOrNull(body.rating) ?? 0;
    
    if (body.categories !== undefined) {
      updateData.categories = Array.isArray(body.categories)
        ? body.categories.map((c: string) => String(c).trim()).filter(Boolean)
        : typeof body.categories === "string" && body.categories.trim()
        ? body.categories.split(",").map((c: string) => c.trim()).filter(Boolean)
        : [];
    }

    if (body.bannerUrl !== undefined) updateData.bannerUrl = toTrimmedOrNull(body.bannerUrl);
    if (body.description !== undefined) updateData.description = toTrimmedOrNull(body.description);
    if (body.avgSavings !== undefined) updateData.avgSavings = toTrimmedOrNull(body.avgSavings);

    const success = await updateStoreMeta(id, updateData);
    if (!success) {
      return NextResponse.json(
        { error: `Store Meta with ID ${id} not found.` },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating store meta:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update store meta." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const idRaw = request.nextUrl.searchParams.get("id");
    const id = toNumberOrNull(idRaw);
    if (!id) {
      return NextResponse.json(
        { error: "Valid Store Meta ID query parameter is required." },
        { status: 400 },
      );
    }

    const success = await deleteStoreMeta(id);

    if (!success) {
      return NextResponse.json(
        { error: `Store Meta with ID ${id} not found.` },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting store meta:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete store meta." },
      { status: 500 },
    );
  }
}
