import { NextRequest, NextResponse } from "next/server";
import { getGuidesFromDb } from "@/lib/db/buyingGuides";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "24", 10);
    const advertiserIdRaw = searchParams.get("advertiserId");

    const data = await getGuidesFromDb({
      page,
      pageSize,
      advertiserId: advertiserIdRaw ? parseInt(advertiserIdRaw, 10) : undefined,
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching guides:", error);
    return NextResponse.json({ error: "Failed to fetch guides." }, { status: 500 });
  }
}
