import { NextRequest, NextResponse } from "next/server";
import { castVote, getVoteCountsBatch } from "@/lib/db/coupon-votes";

export const dynamic = "force-dynamic";

/** GET /api/coupon-votes?ids=id1,id2,id3 — batch fetch counts */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("ids") || "";
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return NextResponse.json({});
  try {
    const counts = await getVoteCountsBatch(ids);
    return NextResponse.json(counts);
  } catch {
    return NextResponse.json({}, { status: 500 });
  }
}

/** POST /api/coupon-votes  body: { couponId, storeSlug, voteType } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { couponId, storeSlug, voteType } = body;
    if (!couponId || !voteType || !["up", "down"].includes(voteType)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Use forwarded IP as a light deduplication key (no PII stored)
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const fingerprint = Buffer.from(`${ip}:${couponId}`).toString("base64").slice(0, 32);

    const counts = await castVote(couponId, storeSlug || "", voteType, fingerprint);
    return NextResponse.json(counts);
  } catch (err) {
    console.error("[coupon-votes] POST error:", err);
    return NextResponse.json({ error: "Failed to cast vote" }, { status: 500 });
  }
}
