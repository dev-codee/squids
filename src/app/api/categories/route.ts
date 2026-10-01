import { NextRequest, NextResponse } from "next/server";
import { getCategories, getCategoriesForCountry } from "@/lib/db/categories";

export const dynamic = "force-dynamic";

/**
 * GET /api/categories
 * Public endpoint to fetch categories (all or featured only).
 * Pass `country` to get per-region store counts that match the category page.
 */
export async function GET(request: NextRequest) {
  try {
    const featuredOnly = request.nextUrl.searchParams.get("featured") === "true";
    const country = request.nextUrl.searchParams.get("country")?.trim();

    const categories = country
      ? await getCategoriesForCountry(country.toUpperCase(), { featuredOnly })
      : await getCategories({ featuredOnly });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Error in GET /api/categories:", error);
    return NextResponse.json({ categories: [] });
  }
}
