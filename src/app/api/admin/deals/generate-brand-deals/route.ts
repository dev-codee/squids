import { NextResponse } from "next/server";
import { generateBrandDeals } from "@/lib/db/deals";
import { revalidatePublic, CACHE_TAGS } from "@/lib/cache";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/deals/generate-brand-deals
 *
 * Create the generic "Best Discounts & Deals at {store}" deal — a codeless
 * `type: "deal"` carrying each store's affiliate tracking link (with our
 * publisher ID) — for EVERY advertiser in the DB. Idempotent: existing brand
 * deals are left untouched (admin edits survive), tracking URLs are re-enforced,
 * and orphaned ones are cleaned up. Protected by the admin session middleware.
 */
export async function POST() {
  try {
    const result = await generateBrandDeals();
    revalidatePublic(CACHE_TAGS.deals, CACHE_TAGS.advertisers, CACHE_TAGS.categories);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Error generating brand deals:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate brand deals." },
      { status: 500 },
    );
  }
}
