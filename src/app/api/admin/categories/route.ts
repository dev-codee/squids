import { NextRequest, NextResponse } from "next/server";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  recountCategoryStats,
} from "@/lib/db/categories";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/categories
 * List all categories with computed store & deal counts.
 */
export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get("search") ?? undefined;
    
    // Recount stats on fetch
    await recountCategoryStats();
    
    const categories = await getCategories({ search });
    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Error in GET /api/admin/categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories." },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/categories
 * Create a new category.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || !body.name) {
      return NextResponse.json(
        { error: "Category name is required." },
        { status: 400 },
      );
    }

    const category = await createCategory(body);
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to create category.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/**
 * PUT /api/admin/categories
 * Update an existing category by ID or slug.
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const idOrSlug = body.id || body.slug;
    if (!idOrSlug) {
      return NextResponse.json(
        { error: "Category ID or slug is required for updates." },
        { status: 400 },
      );
    }

    const category = await updateCategory(idOrSlug, body);
    if (!category) {
      return NextResponse.json(
        { error: "Category not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ category });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to update category.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/**
 * DELETE /api/admin/categories?id=...
 * Delete a category by ID or slug.
 */
export async function DELETE(request: NextRequest) {
  try {
    const idOrSlug = request.nextUrl.searchParams.get("id") || request.nextUrl.searchParams.get("slug");
    if (!idOrSlug) {
      return NextResponse.json(
        { error: "Missing category ID or slug." },
        { status: 400 },
      );
    }

    const success = await deleteCategory(idOrSlug);
    if (!success) {
      return NextResponse.json(
        { error: "Category not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to delete category.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
