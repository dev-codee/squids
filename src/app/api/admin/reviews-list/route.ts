import { NextRequest, NextResponse } from "next/server";
import { getReviewsFromDb } from "@/lib/db/reviews";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "24", 10);
    const advertiserIdRaw = searchParams.get("advertiserId");

    const data = await getReviewsFromDb({
      page,
      pageSize,
      advertiserId: advertiserIdRaw ? parseInt(advertiserIdRaw, 10) : undefined,
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json({ error: "Failed to fetch reviews." }, { status: 500 });
  }
}
