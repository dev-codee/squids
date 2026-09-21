import { NextRequest, NextResponse } from "next/server";
import {
  saveVerification,
  getAllVerificationsForStore,
  type CouponVerification,
} from "@/lib/db/coupon-verifications";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const storeSlug = searchParams.get("storeSlug");
  if (!storeSlug) {
    return NextResponse.json({ error: "storeSlug required" }, { status: 400 });
  }
  const docs = await getAllVerificationsForStore(storeSlug);
  return NextResponse.json({ verifications: docs });
}

export async function POST(req: NextRequest) {
  let body: Omit<CouponVerification, "_id">;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const required: (keyof typeof body)[] = ["couponId", "storeSlug", "storeName", "status", "verifiedBy"];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `Missing field: ${field}` }, { status: 400 });
    }
  }

  await saveVerification({ ...body, verifiedAt: new Date() });
  return NextResponse.json({ ok: true });
}
