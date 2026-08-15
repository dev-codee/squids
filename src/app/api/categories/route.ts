import { NextRequest, NextResponse } from "next/server";
import { getCategories } from "@/lib/db/categories";

export const dynamic = "force-dynamic";

/**
 * GET /api/categories
 * Public endpoint to fetch categories (all or featured only).
 */
export async function GET(request: NextRequest) {
  try {
    const featuredOnly = request.nextUrl.searchParams.get("featured") === "true";
    const categories = await getCategories({ featuredOnly });
    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Error in GET /api/categories:", error);
    return NextResponse.json({ categories: [] });
  }
}
