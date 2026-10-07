import { NextRequest, NextResponse } from "next/server";
import { getDealsFromDb } from "@/lib/db/deals";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  try {
    const result = await getDealsFromDb({
      search: p.get("search") || undefined,
      advertiserId: Number(p.get("advertiserId")) || undefined,
      country: p.get("country") || undefined,
      network: p.get("network") || undefined,
      type: p.get("type") || "all",
      status: "all",
      page: parseInt(p.get("page") || "1", 10) || 1,
      pageSize: parseInt(p.get("pageSize") || "24", 10) || 24,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/deals] Public listing unavailable", error);
    return NextResponse.json({ error: "Offer data is temporarily unavailable." }, { status: 503 });
  }
}
