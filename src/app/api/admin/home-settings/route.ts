import { NextRequest, NextResponse } from "next/server";
import { getHomeSettings, updateHomeSettings } from "@/lib/db/homeSettings";
import { revalidatePublic, CACHE_TAGS } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getHomeSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("GET /api/admin/home-settings error:", error);
    return NextResponse.json({ error: "Failed to load home settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate arrays exist, provide empty fallbacks
    const safeData = {
      reviews: Array.isArray(body.reviews) ? body.reviews : [],
      popularShops: Array.isArray(body.popularShops) ? body.popularShops : [],
      categories: Array.isArray(body.categories) ? body.categories : [],
      faqs: Array.isArray(body.faqs) ? body.faqs : [],
    };

    const success = await updateHomeSettings(safeData);
    if (!success) {
      throw new Error("Update not acknowledged by database");
    }

    revalidatePublic(CACHE_TAGS.homeSettings);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/admin/home-settings error:", error);
    return NextResponse.json({ error: "Failed to update home settings" }, { status: 500 });
  }
}
